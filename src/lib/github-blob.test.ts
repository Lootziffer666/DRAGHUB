import { afterEach, beforeEach, describe, expect, test } from "bun:test";

const backing = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => backing.get(k) ?? null,
  setItem: (k: string, v: string) => void backing.set(k, v),
  removeItem: (k: string) => void backing.delete(k),
  clear: () => backing.clear(),
};

import { fetchRepositoryBlob, setGithubToken, clearGithubToken } from "./github";
import { createImageUrlManager } from "./image-url";

beforeEach(() => {
  backing.clear();
  clearGithubToken();
});

describe("fetchRepositoryBlob — authenticated binary loader", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("sends the same Authorization header as other GitHub requests", async () => {
    setGithubToken("secret-token");
    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      capturedUrl = String(input);
      capturedInit = init;
      const base64 = btoa("binary-payload");
      return new Response(
        JSON.stringify({ content: base64, encoding: "base64", size: base64.length, download_url: null }),
        { status: 200 },
      );
    }) as typeof fetch;

    const blob = await fetchRepositoryBlob({ owner: "acme", repo: "widget", branch: "main", path: "logo.png" });

    expect(capturedUrl).toContain("https://api.github.com/repos/acme/widget/contents/logo.png");
    expect(capturedUrl).toContain("?ref=main");
    const headers = capturedInit?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer secret-token");
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("image/png");
  });

  test("works without a token for public repositories (no Authorization header)", async () => {
    let capturedInit: RequestInit | undefined;
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      capturedInit = init;
      const base64 = btoa("public-bytes");
      return new Response(
        JSON.stringify({ content: base64, encoding: "base64", size: base64.length, download_url: null }),
        { status: 200 },
      );
    }) as typeof fetch;

    await fetchRepositoryBlob({ owner: "acme", repo: "widget", branch: "main", path: "logo.png" });
    const headers = capturedInit?.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });

  test("decodes binary content without corrupting bytes (no TextDecoder round-trip)", async () => {
    // Bytes that are NOT valid UTF-8 on their own — a TextDecoder round-trip
    // would corrupt them (replacement characters), unlike a byte-for-byte
    // base64 decode.
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0xff, 0xd8, 0x00, 0x81]);
    let binary = "";
    for (const b of bytes) binary += String.fromCharCode(b);
    const base64 = btoa(binary);

    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({ content: base64, encoding: "base64", size: base64.length, download_url: null }),
        { status: 200 },
      )) as typeof fetch;

    const blob = await fetchRepositoryBlob({ owner: "acme", repo: "widget", branch: "main", path: "a.png" });
    const buf = new Uint8Array(await blob.arrayBuffer());
    expect(Array.from(buf)).toEqual(Array.from(bytes));
  });

  test("enforces the existing preview size guard", async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          content: "",
          encoding: "base64",
          size: 6 * 1024 * 1024,
          download_url: null,
        }),
        { status: 200 },
      )) as typeof fetch;

    await expect(
      fetchRepositoryBlob({ owner: "acme", repo: "widget", branch: "main", path: "huge.png" }),
    ).rejects.toThrow(/Large file preview is disabled/);
  });
});

describe("createImageUrlManager — Object URL lifecycle", () => {
  const originalURL = globalThis.URL;
  afterEach(() => {
    (globalThis as Record<string, unknown>).URL = originalURL;
  });

  function installFakeUrl() {
    const created: string[] = [];
    const revoked: string[] = [];
    (globalThis as Record<string, unknown>).URL = {
      createObjectURL: (_blob: Blob) => {
        const id = `blob:${created.length}`;
        created.push(id);
        return id;
      },
      revokeObjectURL: (url: string) => {
        revoked.push(url);
      },
    };
    return { created, revoked };
  }

  test("create() produces an object URL and tracks it as current", () => {
    installFakeUrl();
    const manager = createImageUrlManager();
    const url = manager.create(new Blob(["a"]));
    expect(url).toBe("blob:0");
    expect(manager.current).toBe(url);
  });

  test("attaching a new blob revokes the previous URL before creating the next", () => {
    const { created, revoked } = installFakeUrl();
    const manager = createImageUrlManager();
    const first = manager.create(new Blob(["a"]));
    const second = manager.create(new Blob(["b"]));
    expect(created).toEqual([first, second]);
    expect(revoked).toEqual([first]);
    expect(manager.current).toBe(second);
  });

  test("revoke() releases the current URL and clears it (unmount cleanup)", () => {
    const { revoked } = installFakeUrl();
    const manager = createImageUrlManager();
    const url = manager.create(new Blob(["a"]));
    manager.revoke();
    expect(revoked).toEqual([url]);
    expect(manager.current).toBeNull();
    // revoke() is idempotent — no double-revoke on repeated calls.
    manager.revoke();
    expect(revoked).toEqual([url]);
  });
});
