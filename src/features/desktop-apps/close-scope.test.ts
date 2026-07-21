import { beforeEach, describe, expect, test } from "bun:test";

// Minimal localStorage shim so the domain stores (changes buckets, editor
// drafts, recycle bin, token) run inside bun test.
const backing = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => backing.get(k) ?? null,
  setItem: (k: string, v: string) => void backing.set(k, v),
  removeItem: (k: string) => void backing.delete(k),
  clear: () => backing.clear(),
};

// Minimal fake IndexedDB so stageEditDirect's blob writes (src/lib/staging-db.ts)
// run inside bun test, which has no real IndexedDB.
type FakeIdbRequest = { result?: unknown; onsuccess?: () => void; onerror?: () => void };
function makeFakeIndexedDB() {
  const blobs = new Map<string, Uint8Array>();
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

import {
  changesFor,
  updateBucket,
  __resetChangesStoreForTests,
} from "@/features/changes/store";
import {
  openSession,
  updateDraft,
  discardDraft,
  isDirty,
  getSession,
} from "@/lib/editor-sessions";
import { listRetained, __resetRecycleBinForTests } from "@/lib/recycle-bin";
import { setGithubToken, clearGithubToken } from "@/lib/github";
import {
  createDesktopLifecycleAdapter,
  deriveCloseScope,
} from "./lifecycle-adapter";
import type {
  DesktopWindowState,
  WindowCloseContext,
} from "@/features/desktop/types";
import type { WorkingChange } from "@/lib/github-ops";

const REPO_A = "owner/alpha";
const REPO_B = "owner/beta";

function repoWindow(id: string, repoKey: string): DesktopWindowState {
  return {
    id,
    kind: "repository",
    applicationId: "repository-explorer",
    owner: { type: "desktop" },
    resource: { type: "repository", repoKey },
    title: repoKey,
    iconKey: "repo",
    presentation: "normal",
    minimized: false,
    bounds: { x: 0, y: 46, width: 800, height: 600 },
    zIndex: 1,
    groupKey: repoKey,
    createdAt: 0,
    lastFocusedAt: 0,
  };
}

function editorWindow(
  id: string,
  repoKey: string,
  path: string,
  repositoryWindowId?: string,
): DesktopWindowState {
  return {
    ...repoWindow(id, repoKey),
    kind: "editor",
    applicationId: "file-editor",
    owner: repositoryWindowId
      ? { type: "repository", repoKey, repositoryWindowId }
      : { type: "desktop" },
    resource: { type: "file", repoKey, path },
    title: path,
  };
}

function viewerWindow(
  id: string,
  repoKey: string,
  path: string,
  repositoryWindowId?: string,
): DesktopWindowState {
  return {
    ...repoWindow(id, repoKey),
    kind: "viewer",
    applicationId: "image-viewer",
    owner: repositoryWindowId
      ? { type: "repository", repoKey, repositoryWindowId }
      : { type: "desktop" },
    resource: { type: "file", repoKey, path },
    title: path,
  };
}

function closeContext(
  target: DesktopWindowState,
  children: DesktopWindowState[] = [],
): Omit<WindowCloseContext, "blockers" | "inspectionStatus" | "resolutionStatus"> {
  return { transactionId: "tx-test", target, children, reason: "user-request" };
}

function readyContext(
  target: DesktopWindowState,
  children: DesktopWindowState[] = [],
): WindowCloseContext {
  return {
    ...closeContext(target, children),
    blockers: [],
    inspectionStatus: "ready",
    resolutionStatus: "idle",
  };
}

function change(over: Partial<WorkingChange>): WorkingChange {
  return {
    id: crypto.randomUUID(),
    kind: "add",
    entryKind: "file",
    path: "notes.md",
    origin: "manual",
    createdAt: Date.now(),
    ...over,
  };
}

const adapter = createDesktopLifecycleAdapter((repoKey) =>
  repoKey === REPO_A
    ? { key: REPO_A, meta: { owner: "owner", repo: "alpha", branch: "main" } }
    : repoKey === REPO_B
      ? { key: REPO_B, meta: { owner: "owner", repo: "beta", branch: "main" } }
      : null,
);

beforeEach(() => {
  backing.clear();
  __resetChangesStoreForTests();
  __resetRecycleBinForTests();
  clearGithubToken();
  for (const repo of [REPO_A, REPO_B]) {
    for (const path of ["a.ts", "b.ts", "notes.md", "c.ts"]) {
      const s = getSession(repo, path);
      if (s) discardDraft(repo, path);
    }
  }
});

describe("deriveCloseScope", () => {
  test("repository window resolves to repository scope", () => {
    expect(deriveCloseScope(repoWindow("w1", REPO_A))).toEqual({
      mode: "repository",
      repoKey: REPO_A,
    });
  });
  test("editor window resolves to editor scope with path", () => {
    expect(deriveCloseScope(editorWindow("w2", REPO_A, "a.ts"))).toEqual({
      mode: "editor",
      repoKey: REPO_A,
      path: "a.ts",
    });
  });
  test("viewer window resolves to viewer scope with path", () => {
    expect(deriveCloseScope(viewerWindow("w3", REPO_A, "a.svg"))).toEqual({
      mode: "viewer",
      repoKey: REPO_A,
      path: "a.svg",
    });
  });
  test("other application/system/tool windows resolve to none", () => {
    const toolWindow: DesktopWindowState = {
      ...repoWindow("w4", REPO_A),
      kind: "tool",
      applicationId: "tool-window",
      resource: { type: "tool", toolId: "scratchpad" },
    };
    expect(deriveCloseScope(toolWindow)).toEqual({ mode: "none" });
  });
});

describe("lone editor window close — scope isolation", () => {
  test("editor detects only its own dirty draft", async () => {
    openSession(REPO_A, "a.ts", "base");
    updateDraft(REPO_A, "a.ts", "changed");
    const blockers = await adapter.inspectClose(closeContext(editorWindow("e1", REPO_A, "a.ts")));
    expect(blockers).toEqual([
      { type: "unsaved-draft", windowId: "e1", label: "Unsaved draft: a.ts" },
    ]);
  });

  test("editor ignores other file drafts in the same repository", async () => {
    openSession(REPO_A, "a.ts", "base");
    updateDraft(REPO_A, "a.ts", "changed");
    openSession(REPO_A, "b.ts", "base");
    updateDraft(REPO_A, "b.ts", "changed too");
    const blockers = await adapter.inspectClose(closeContext(editorWindow("e1", REPO_A, "a.ts")));
    expect(blockers).toHaveLength(1);
    expect(blockers[0]).toMatchObject({ windowId: "e1", label: "Unsaved draft: a.ts" });
  });

  test("editor ignores repository Working Changes when closing alone", async () => {
    updateBucket(REPO_A, (prev) => [...prev, change({ path: "x.ts" })]);
    const blockers = await adapter.inspectClose(closeContext(editorWindow("e1", REPO_A, "a.ts")));
    expect(blockers).toHaveLength(0);
  });

  test("viewer is not blocked by a dirty draft for the same file", async () => {
    openSession(REPO_A, "a.svg", "base");
    updateDraft(REPO_A, "a.svg", "changed");
    const blockers = await adapter.inspectClose(closeContext(viewerWindow("v1", REPO_A, "a.svg")));
    expect(blockers).toHaveLength(0);
  });

  test("editor save (commit-and-close) stages only one file", async () => {
    openSession(REPO_A, "a.ts", "base");
    updateDraft(REPO_A, "a.ts", "changed");
    openSession(REPO_A, "b.ts", "base");
    updateDraft(REPO_A, "b.ts", "also changed");

    const result = await adapter.resolveClose(readyContext(editorWindow("e1", REPO_A, "a.ts")), {
      action: "commit-and-close",
    });

    expect(result.success).toBe(true);
    expect(changesFor(REPO_A)).toHaveLength(1);
    expect(changesFor(REPO_A)[0].path).toBe("a.ts");
    // The other file's draft is untouched.
    expect(isDirty(REPO_A, "b.ts")).toBe(true);
    expect(getSession(REPO_A, "b.ts")?.draft).toBe("also changed");
  });

  test("editor save creates no repository checkpoint (no token required)", async () => {
    openSession(REPO_A, "a.ts", "base");
    updateDraft(REPO_A, "a.ts", "changed");
    // No GitHub token configured — a repository commit-and-close would fail
    // with a "token" error. An editor-scoped save must succeed regardless,
    // since it never checkpoints.
    const result = await adapter.resolveClose(readyContext(editorWindow("e1", REPO_A, "a.ts")), {
      action: "commit-and-close",
    });
    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });

  test("editor discard creates exactly one kernel entry for that file", async () => {
    openSession(REPO_A, "a.ts", "base");
    updateDraft(REPO_A, "a.ts", "draft text");
    const result = await adapter.resolveClose(readyContext(editorWindow("e1", REPO_A, "a.ts")), {
      action: "discard-to-recycle-bin-and-close",
    });
    expect(result.success).toBe(true);
    expect(result.recycleBinEntries).toHaveLength(1);
    expect(result.recycleBinEntries?.[0]).toMatchObject({
      kind: "draft",
      repoKey: REPO_A,
      path: "a.ts",
      payload: { content: "draft text" },
    });
    expect(isDirty(REPO_A, "a.ts")).toBe(false);
  });

  test("editor discard preserves every other draft and Working Change", async () => {
    openSession(REPO_A, "a.ts", "base");
    updateDraft(REPO_A, "a.ts", "draft text");
    openSession(REPO_A, "b.ts", "base");
    updateDraft(REPO_A, "b.ts", "unrelated draft");
    updateBucket(REPO_A, (prev) => [...prev, change({ path: "x.ts", kind: "modify", blobId: "blob-x" })]);

    const result = await adapter.resolveClose(readyContext(editorWindow("e1", REPO_A, "a.ts")), {
      action: "discard-to-recycle-bin-and-close",
    });

    expect(result.success).toBe(true);
    expect(result.recycleBinEntries).toHaveLength(1);
    // Unrelated draft survives untouched.
    expect(isDirty(REPO_A, "b.ts")).toBe(true);
    expect(getSession(REPO_A, "b.ts")?.draft).toBe("unrelated draft");
    // The repository's Working Changes bucket is untouched (not emptied,
    // not retained).
    expect(changesFor(REPO_A)).toHaveLength(1);
    expect(changesFor(REPO_A)[0].path).toBe("x.ts");
    expect(listRetained(REPO_A)).toHaveLength(0);
  });

  test("viewer close never stages, commits, discards, or retains repository changes", async () => {
    updateBucket(REPO_A, (prev) => [...prev, change({ path: "x.ts", kind: "modify", blobId: "blob-x" })]);
    openSession(REPO_A, "a.ts", "base");
    updateDraft(REPO_A, "a.ts", "changed");

    const commitResult = await adapter.resolveClose(readyContext(viewerWindow("v1", REPO_A, "a.svg")), {
      action: "commit-and-close",
    });
    expect(commitResult).toEqual({ success: true });
    expect(changesFor(REPO_A)).toHaveLength(1); // untouched

    const discardResult = await adapter.resolveClose(readyContext(viewerWindow("v1", REPO_A, "a.svg")), {
      action: "discard-to-recycle-bin-and-close",
    });
    expect(discardResult).toEqual({ success: true });
    expect(changesFor(REPO_A)).toHaveLength(1); // still untouched
    expect(isDirty(REPO_A, "a.ts")).toBe(true); // unrelated draft untouched
  });
});

describe("repository parent close — unchanged repo-wide behavior", () => {
  test("repository parent still inspects all dirty drafts and its Working Changes bucket", async () => {
    openSession(REPO_A, "a.ts", "base");
    updateDraft(REPO_A, "a.ts", "changed");
    updateBucket(REPO_A, (prev) => [...prev, change({ path: "x.ts" }), change({ path: "y.ts" })]);
    const blockers = await adapter.inspectClose(closeContext(repoWindow("w1", REPO_A)));
    expect(blockers).toEqual(
      expect.arrayContaining([
        { type: "unsaved-draft", windowId: "w1", label: "Unsaved draft: a.ts" },
        { type: "working-changes", windowId: "w1", count: 2 },
      ]),
    );
  });

  test("repository parent commit-and-close stages repository drafts and checkpoints", async () => {
    setGithubToken("secret-token");
    const originalFetch = globalThis.fetch;
    // Every step of commitWorkingChanges (resolve base ref, create blob,
    // create tree, create commit, update ref) reads either `.sha` or
    // `.object.sha` from the response — a single shape satisfies all of them.
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ sha: "x", object: { sha: "x" } }), {
        status: 200,
      })) as typeof fetch;

    openSession(REPO_A, "a.ts", "base");
    updateDraft(REPO_A, "a.ts", "changed");

    const result = await adapter.resolveClose(readyContext(repoWindow("w1", REPO_A)), {
      action: "commit-and-close",
    });

    globalThis.fetch = originalFetch;
    expect(result.success).toBe(true);
    expect(isDirty(REPO_A, "a.ts")).toBe(false);
  });
});

describe("no cross-repository lifecycle effects", () => {
  test("closing a repo A editor never touches repo B state", async () => {
    openSession(REPO_A, "a.ts", "base");
    updateDraft(REPO_A, "a.ts", "changed");
    openSession(REPO_B, "b.ts", "base");
    updateDraft(REPO_B, "b.ts", "changed too");
    updateBucket(REPO_B, (prev) => [...prev, change({ path: "z.ts" })]);

    const result = await adapter.resolveClose(readyContext(editorWindow("e1", REPO_A, "a.ts")), {
      action: "discard-to-recycle-bin-and-close",
    });

    expect(result.success).toBe(true);
    expect(isDirty(REPO_B, "b.ts")).toBe(true);
    expect(changesFor(REPO_B)).toHaveLength(1);
  });

  test("closing repo A's repository window never touches repo B state", async () => {
    updateBucket(REPO_A, (prev) => [...prev, change({ path: "x.ts", kind: "modify", blobId: "blob-x" })]);
    updateBucket(REPO_B, (prev) => [...prev, change({ path: "z.ts", kind: "modify", blobId: "blob-z" })]);

    const result = await adapter.resolveClose(readyContext(repoWindow("w1", REPO_A)), {
      action: "discard-to-recycle-bin-and-close",
    });

    expect(result.success).toBe(true);
    expect(changesFor(REPO_A)).toHaveLength(0);
    expect(changesFor(REPO_B)).toHaveLength(1);
    expect(listRetained(REPO_B)).toHaveLength(0);
  });
});
