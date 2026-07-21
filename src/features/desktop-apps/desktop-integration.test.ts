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
import { listRetained } from "@/lib/recycle-bin";
import { createDesktopLifecycleAdapter } from "./lifecycle-adapter";
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
  repositoryWindowId: string
): DesktopWindowState {
  return {
    ...repoWindow(id, repoKey),
    kind: "editor",
    applicationId: "file-editor",
    owner: { type: "repository", repoKey, repositoryWindowId },
    resource: { type: "file", repoKey, path },
    title: path,
  };
}

function closeContext(
  target: DesktopWindowState,
  children: DesktopWindowState[] = []
): Omit<
  WindowCloseContext,
  "blockers" | "inspectionStatus" | "resolutionStatus"
> {
  return {
    transactionId: "tx-test",
    target,
    children,
    reason: "user-request",
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
    : null
);

beforeEach(() => {
  backing.clear();
  __resetChangesStoreForTests();
  // Reset any editor sessions from earlier tests.
  for (const repo of [REPO_A, REPO_B]) {
    for (const path of ["a.ts", "b.ts", "notes.md"]) {
      const s = getSession(repo, path);
      if (s) discardDraft(repo, path);
    }
  }
});

describe("changes bucket store", () => {
  test("buckets are isolated per repository", () => {
    updateBucket(REPO_A, (prev) => [...prev, change({ path: "a.ts" })]);
    updateBucket(REPO_B, (prev) => [...prev, change({ path: "b.ts" })]);
    expect(changesFor(REPO_A)).toHaveLength(1);
    expect(changesFor(REPO_B)).toHaveLength(1);
    expect(changesFor(REPO_A)[0].path).toBe("a.ts");
    expect(changesFor(REPO_B)[0].path).toBe("b.ts");
  });

  test("empty buckets return a stable reference", () => {
    expect(changesFor("owner/none")).toBe(changesFor("owner/other"));
  });
});

describe("lifecycle adapter — inspectClose", () => {
  test("clean repository window has no blockers", async () => {
    const blockers = await adapter.inspectClose(
      closeContext(repoWindow("w1", REPO_A))
    );
    expect(blockers).toHaveLength(0);
  });

  test("pending changes produce a working-changes blocker", async () => {
    updateBucket(REPO_A, (prev) => [...prev, change({}), change({ path: "x" })]);
    const blockers = await adapter.inspectClose(
      closeContext(repoWindow("w1", REPO_A))
    );
    expect(blockers).toEqual([
      { type: "working-changes", windowId: "w1", count: 2 },
    ]);
  });

  test("dirty editor session produces an unsaved-draft blocker", async () => {
    openSession(REPO_A, "a.ts", "base");
    updateDraft(REPO_A, "a.ts", "changed");
    const blockers = await adapter.inspectClose(
      closeContext(repoWindow("w1", REPO_A))
    );
    expect(blockers).toEqual([
      { type: "unsaved-draft", windowId: "w1", label: "Unsaved draft: a.ts" },
    ]);
  });

  test("a child editor window owns its file's draft blocker", async () => {
    openSession(REPO_A, "a.ts", "base");
    updateDraft(REPO_A, "a.ts", "changed");
    const parent = repoWindow("w1", REPO_A);
    const child = editorWindow("w2", REPO_A, "a.ts", "w1");
    const blockers = await adapter.inspectClose(closeContext(parent, [child]));
    expect(blockers).toEqual([
      { type: "unsaved-draft", windowId: "w2", label: "Unsaved draft: a.ts" },
    ]);
  });

  test("another repository's state never leaks into inspection", async () => {
    updateBucket(REPO_B, (prev) => [...prev, change({})]);
    openSession(REPO_B, "b.ts", "base");
    updateDraft(REPO_B, "b.ts", "changed");
    const blockers = await adapter.inspectClose(
      closeContext(repoWindow("w1", REPO_A))
    );
    expect(blockers).toHaveLength(0);
    discardDraft(REPO_B, "b.ts");
  });
});

describe("lifecycle adapter — resolveClose", () => {
  test("discard moves drafts to kernel entries and changes to the domain bin", async () => {
    openSession(REPO_A, "a.ts", "base");
    updateDraft(REPO_A, "a.ts", "draft text");
    updateBucket(REPO_A, (prev) => [
      ...prev,
      change({ kind: "modify", path: "m.ts", blobId: "blob-1", size: 5 }),
      change({ kind: "delete", path: "gone.ts", blobId: undefined }),
    ]);

    const context: WindowCloseContext = {
      ...closeContext(repoWindow("w1", REPO_A)),
      blockers: [],
      inspectionStatus: "ready",
      resolutionStatus: "idle",
    };
    const result = await adapter.resolveClose(context, {
      action: "discard-to-recycle-bin-and-close",
    });

    expect(result.success).toBe(true);
    // The unsaved draft became a kernel Recycle-Bin entry…
    expect(result.recycleBinEntries).toHaveLength(1);
    expect(result.recycleBinEntries?.[0]).toMatchObject({
      kind: "draft",
      repoKey: REPO_A,
      path: "a.ts",
      payload: { content: "draft text" },
    });
    // …the session is clean, the bucket empty, and the blob-bearing change
    // retained in the domain Recycle Bin.
    expect(isDirty(REPO_A, "a.ts")).toBe(false);
    expect(changesFor(REPO_A)).toHaveLength(0);
    const retained = listRetained(REPO_A);
    expect(retained).toHaveLength(1);
    expect(retained[0].change.path).toBe("m.ts");
  });

  test("commit-and-close without a token fails with a clear error", async () => {
    updateBucket(REPO_A, (prev) => [...prev, change({})]);
    const context: WindowCloseContext = {
      ...closeContext(repoWindow("w1", REPO_A)),
      blockers: [],
      inspectionStatus: "ready",
      resolutionStatus: "idle",
    };
    const result = await adapter.resolveClose(context, {
      action: "commit-and-close",
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("token");
  });

  test("close-clean succeeds without touching state", async () => {
    const context: WindowCloseContext = {
      ...closeContext(repoWindow("w1", REPO_A)),
      blockers: [],
      inspectionStatus: "ready",
      resolutionStatus: "idle",
    };
    const result = await adapter.resolveClose(context, {
      action: "close-clean",
    });
    expect(result).toEqual({ success: true });
  });
});

describe("lifecycle adapter — restoreEntry", () => {
  test("restoring a draft entry re-creates the dirty editor session", async () => {
    const result = await adapter.restoreEntry({
      id: "e1",
      kind: "draft",
      sourceWindowId: "w1",
      repoKey: REPO_A,
      path: "notes.md",
      label: "Unsaved draft — notes.md",
      discardedAt: Date.now(),
      payload: { content: "# restored" },
    });
    expect(result.success).toBe(true);
    expect(isDirty(REPO_A, "notes.md")).toBe(true);
    expect(getSession(REPO_A, "notes.md")?.draft).toBe("# restored");
  });
});
