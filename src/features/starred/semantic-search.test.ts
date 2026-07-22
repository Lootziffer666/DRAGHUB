import { afterEach, beforeEach, describe, expect, test } from "bun:test";

const localBacking = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => localBacking.get(k) ?? null,
  setItem: (k: string, v: string) => void localBacking.set(k, v),
  removeItem: (k: string) => void localBacking.delete(k),
  clear: () => localBacking.clear(),
};

// Minimal fake IndexedDB, mirroring the shim already used for
// desktop-apps/desktop-integration.test.ts — semantic-search.ts stores
// embeddings through the same generic blob store (src/lib/staging-db.ts).
type FakeIdbRequest = { result?: unknown; onsuccess?: () => void; onerror?: () => void };
const blobs = new Map<string, Uint8Array>();
function makeFakeIndexedDB() {
  return {
    open(_name: string, _version: number) {
      const openReq: FakeIdbRequest = {};
      queueMicrotask(() => {
        const db = {
          objectStoreNames: { contains: () => true },
          createObjectStore: () => {},
          transaction(_storeName: string, _mode: string) {
            const tx: { oncomplete?: () => void; onerror?: () => void } = {};
            return {
              objectStore: () => ({
                put: (value: Uint8Array, key: string) => {
                  blobs.set(key, value);
                  queueMicrotask(() => tx.oncomplete?.());
                  return {};
                },
                get: (key: string) => {
                  const req: FakeIdbRequest = {};
                  queueMicrotask(() => {
                    req.result = blobs.get(key);
                    req.onsuccess?.();
                  });
                  return req;
                },
                delete: (key: string) => {
                  blobs.delete(key);
                  queueMicrotask(() => tx.oncomplete?.());
                  return {};
                },
                clear: () => {
                  blobs.clear();
                  queueMicrotask(() => tx.oncomplete?.());
                  return {};
                },
              }),
              get oncomplete() {
                return tx.oncomplete;
              },
              set oncomplete(v) {
                tx.oncomplete = v;
              },
              get onerror() {
                return tx.onerror;
              },
              set onerror(v) {
                tx.onerror = v;
              },
            };
          },
          close: () => {},
        };
        openReq.result = db;
        openReq.onsuccess?.();
      });
      return openReq;
    },
  };
}
(globalThis as Record<string, unknown>).indexedDB = makeFakeIndexedDB();

import { setAiConfig } from "@/lib/ai";
import { ensureEmbeddings, semanticRank } from "./semantic-search";
import type { StarredRepo } from "./api";

function repo(fullName: string, description: string): StarredRepo {
  const [owner, name] = fullName.split("/");
  return {
    fullName,
    owner,
    repo: name,
    description,
    stars: 1,
    language: null,
    private: false,
    htmlUrl: "x",
    updatedAt: "2026-01-01T00:00:00Z",
  };
}

// Deterministic fake embeddings: a 2D vector derived from which keyword the
// text contains, so similarity ranking is predictable without a real model.
function fakeVector(text: string): number[] {
  const lower = text.toLowerCase();
  if (lower.includes("alpha")) return [1, 0];
  if (lower.includes("beta")) return [0, 1];
  return [0.5, 0.5];
}

let fetchCalls = 0;
const originalFetch = globalThis.fetch;

function installFakeFetch() {
  fetchCalls = 0;
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    fetchCalls++;
    const body = JSON.parse((init?.body as string) ?? "{}");
    const texts: string[] = body.input;
    return {
      ok: true,
      status: 200,
      json: async () => ({
        data: texts.map((t, i) => ({ index: i, embedding: fakeVector(t) })),
      }),
    } as Response;
  }) as typeof fetch;
}

beforeEach(() => {
  localBacking.clear();
  blobs.clear();
  setAiConfig({
    baseUrl: "https://bellows.example/v1",
    apiKey: "sk-test",
    chatModel: "test-chat",
    embeddingModel: "test-embed",
  });
  installFakeFetch();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("ensureEmbeddings", () => {
  test("computes and caches embeddings, then skips already-cached repos", async () => {
    const repos = [repo("a/alpha-repo", "an alpha project"), repo("b/beta-repo", "a beta project")];
    await ensureEmbeddings(repos);
    expect(fetchCalls).toBe(1); // one batched request for both repos

    await ensureEmbeddings(repos);
    expect(fetchCalls).toBe(1); // second call is a pure cache hit, no new request
  });

  test("only re-embeds repos whose source text actually changed", async () => {
    const repos = [repo("a/alpha-repo", "an alpha project"), repo("b/beta-repo", "a beta project")];
    await ensureEmbeddings(repos);
    expect(fetchCalls).toBe(1);

    const updated = [repo("a/alpha-repo", "an alpha project, rewritten"), repos[1]];
    await ensureEmbeddings(updated);
    expect(fetchCalls).toBe(2); // only the changed repo triggers a new request
  });
});

describe("semanticRank", () => {
  test("ranks repos by similarity to the query, closest first", async () => {
    const repos = [
      repo("a/alpha-repo", "an alpha project"),
      repo("b/beta-repo", "a beta project"),
    ];
    const ranked = await semanticRank(repos, "looking for something alpha");
    expect(ranked[0].repo.fullName).toBe("a/alpha-repo");
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
  });

  test("flips ranking order for a differently-worded query", async () => {
    const repos = [
      repo("a/alpha-repo", "an alpha project"),
      repo("b/beta-repo", "a beta project"),
    ];
    const ranked = await semanticRank(repos, "beta features please");
    expect(ranked[0].repo.fullName).toBe("b/beta-repo");
  });
});
