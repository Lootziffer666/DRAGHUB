import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

/**
 * PR #9 regression suite — part 2.
 *
 * Covers the unified Recycle Bin empty (kernel + domain retention) and the
 * authenticated private-binary loader / object-URL image viewer.
 *
 * No @testing-library/react is installed in this repo, so every assertion here
 * stays at the EXPORTED PURE-HELPER level (recycleBinSummary, emptyRecycleBinAll,
 * fetchRepositoryBlob, createImageUrlManager). The Recycle Bin `onEmpty` in
 * RecycleBinApp.tsx is a thin wrapper around `emptyRecycleBinAll`, so asserting
 * the helper fully exercises the unified behavior.
 */

// Minimal localStorage shim so the domain stores (changes buckets, token,
// recycle bin) run inside bun test.
const backing = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => backing.get(k) ?? null,
  setItem: (k: string, v: string) => void backing.set(k, v),
  removeItem: (k: string) => void backing.delete(k),
  clear: () => backing.clear(),
};

import {
  emptyRecycleBinAll,
  recycleBinSummary,
  type EmptyRecycleBinSession,
} from "@/features/recycle-bin/recycle-bin-summary";
import type { RecycleBinEntry } from "@/features/desktop/types";
import type { RetainedChange } from "@/lib/recycle-bin";
import {
  changesFor,
  updateBucket,
  __resetChangesStoreForTests,
} from "@/features/changes/store";
import {
  fetchRepositoryBlob,
  setGithubToken,
  clearGithubToken,
} from "@/lib/github";
import { createImageUrlManager } from "@/lib/image-url";
import type { WorkingChange } from "@/lib/github-ops";

const REPO_A = "owner/alpha";
const REPO_B = "owner/beta";

function kernelEntry(repoKey: string, path: string): RecycleBinEntry {
  return {
    id: crypto.randomUUID(),
    kind: "draft",
    sourceWindowId: "w",
    repoKey,
    path,
    label: path,
    discardedAt: Date.now(),
    payload: { content: "draft body" },
  };
}

function retainedEntry(repoKey: string, path: string): RetainedChange {
  const change: WorkingChange = {
    id: crypto.randomUUID(),
    kind: "modify",
    entryKind: "file",
    path,
    origin: "edit",
    size: 7,
    blobId: `blob-${repoKey}-${path}`,
    createdAt: Date.now(),
  };
  return { change, repoKey, discardedAt: Date.now() };
}

function change(over: Partial<WorkingChange>): WorkingChange {
  return {
    id: crypto.randomUUID(),
    kind: "delete",
    entryKind: "file",
    path: "gone.txt",
    origin: "manual",
    createdAt: Date.now(),
    ...over,
  };
}

beforeEach(() => {
  backing.clear();
  __resetChangesStoreForTests();
  clearGithubToken();
});

describe("recycle bin (unified empty) — scenarios 18-20", () => {
  test("18. Empty clears both kernel and domain entries", async () => {
    const kernel = [kernelEntry(REPO_A, "a.ts"), kernelEntry(REPO_B, "b.ts")];
    const domain = [
      retainedEntry(REPO_A, "x.ts"),
      retainedEntry(REPO_B, "y.ts"),
    ];

    const summary = recycleBinSummary(kernel, domain);
    expect(summary.kernelCount).toBe(2);
    expect(summary.domainCount).toBe(2);

    const sessionCalls: string[] = [];
    const session: EmptyRecycleBinSession = {
      emptyRecycleBin: () => sessionCalls.push("kernel"),
    };
    const emptyBinCalls: string[] = [];
    const fakeEmptyBin = mock((repoKey: string) => {
      emptyBinCalls.push(repoKey);
      return Promise.resolve(1);
    });

    await emptyRecycleBinAll({
      session,
      kernelEntries: kernel,
      domainEntries: domain,
      emptyBin: fakeEmptyBin as unknown as (r: string) => Promise<number>,
    });

    // Kernel entries cleared through the session.
    expect(sessionCalls).toEqual(["kernel"]);
    // Domain retention cleared per repository that had retained changes.
    expect(emptyBinCalls.sort()).toEqual([REPO_A, REPO_B]);
    expect(fakeEmptyBin).toHaveBeenCalledTimes(2);
  });

  test("19. Empty works when ONLY kernel entries exist", async () => {
    const kernel = [kernelEntry(REPO_A, "a.ts")];
    const domain: RetainedChange[] = [];

    const summary = recycleBinSummary(kernel, domain);
    expect(summary.kernelCount).toBe(1);
    expect(summary.domainCount).toBe(0);

    const sessionCalls: string[] = [];
    const session: EmptyRecycleBinSession = {
      emptyRecycleBin: () => sessionCalls.push("kernel"),
    };
    const fakeEmptyBin = mock(() => Promise.resolve(0));

    await emptyRecycleBinAll({
      session,
      kernelEntries: kernel,
      domainEntries: domain,
      emptyBin: fakeEmptyBin as unknown as (r: string) => Promise<number>,
    });

    // Kernel is still cleared…
    expect(sessionCalls).toEqual(["kernel"]);
    // …but no per-repo domain empty is needed (no retained changes).
    expect(fakeEmptyBin).not.toHaveBeenCalled();
  });

  test("20. Staged deletions remain untouched by Empty", async () => {
    // Seed a staged deletion in the working-changes bucket.
    const staged = change({ kind: "delete", path: "removed.txt", repoKey: REPO_A });
    updateBucket(REPO_A, (prev) => [...prev, staged]);

    const kernel = [kernelEntry(REPO_A, "a.ts")];
    const domain = [retainedEntry(REPO_A, "x.ts")];

    const session: EmptyRecycleBinSession = {
      emptyRecycleBin: () => {},
    };
    const fakeEmptyBin = mock((r: string) => Promise.resolve(1));

    await emptyRecycleBinAll({
      session,
      kernelEntries: kernel,
      domainEntries: domain,
      emptyBin: fakeEmptyBin as unknown as (r: string) => Promise<number>,
    });

    // The staged deletion lives in the working-changes bucket and must be
    // preserved by the unified empty.
    const remaining = changesFor(REPO_A).filter((c) => c.kind === "delete");
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(staged.id);
  });
});

describe("authenticated binary loader — scenarios 21-23", () => {
  const originalFetch = globalThis.fetch;
  const originalURL = globalThis.URL;

  function installFakeUrl() {
    const created: string[] = [];
    const revoked: string[] = [];
    const fakeUrl = {
      createObjectURL: (blob: Blob) => {
        const id = `blob:${created.length}`;
        created.push(id);
        return id;
      },
      revokeObjectURL: (url: string) => {
        revoked.push(url);
      },
    };
    (globalThis as Record<string, unknown>).URL = fakeUrl as unknown as typeof URL;
    return { created, revoked };
  }

  afterEach(() => {
    globalThis.fetch = originalFetch;
    (globalThis as Record<string, unknown>).URL = originalURL;
  });

  test("21. Binary loader sends Authentication and returns a Blob", async () => {
    setGithubToken("secret-token");

    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      capturedUrl = String(input);
      capturedInit = init;
      const base64 = btoa("binary-payload");
      return new Response(
        JSON.stringify({
          content: base64,
          encoding: "base64",
          size: base64.length,
          download_url: null,
        }),
        { status: 200 }
      );
    }) as typeof fetch;

    const blob = await fetchRepositoryBlob({
      owner: "acme",
      repo: "widget",
      branch: "main",
      path: "assets/logo.png",
    });

    expect(capturedUrl).toContain(
      "https://api.github.com/repos/acme/widget/contents/"
    );
    expect(capturedUrl).toContain("?ref=main");
    expect(capturedInit?.headers).toBeDefined();
    const headers = capturedInit!.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer secret-token");

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBe(
      new TextEncoder().encode("binary-payload").length
    );
  });

  test("22. Image viewer produces a blob: object URL from a fetched Blob", async () => {
    setGithubToken("secret-token");
    const { created } = installFakeUrl();

    globalThis.fetch = (async () => {
      const base64 = btoa("img-bytes");
      return new Response(
        JSON.stringify({
          content: base64,
          encoding: "base64",
          size: base64.length,
          download_url: null,
        }),
        { status: 200 }
      );
    }) as typeof fetch;

    const blob = await fetchRepositoryBlob({
      owner: "acme",
      repo: "widget",
      branch: "main",
      path: "assets/logo.png",
    });

    const manager = createImageUrlManager();
    const url = manager.create(blob);

    expect(url.startsWith("blob:")).toBe(true);
    expect(created).toEqual([url]);
  });

  test("23. Object URL is revoked on unmount / when replaced", async () => {
    const { created, revoked } = installFakeUrl();

    const manager = createImageUrlManager();

    const first = manager.create(new Blob(["a"]));
    expect(first.startsWith("blob:")).toBe(true);
    expect(created).toEqual([first]);

    // Attaching a second blob must revoke the first URL before creating a new one.
    const second = manager.create(new Blob(["b"]));
    expect(second.startsWith("blob:")).toBe(true);
    expect(revoked).toEqual([first]);

    // Explicit teardown revokes the currently held URL.
    manager.revoke();
    expect(revoked).toEqual([first, second]);
    expect(manager.current).toBeNull();
  });
});
