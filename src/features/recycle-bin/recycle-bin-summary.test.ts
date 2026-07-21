import { beforeEach, describe, expect, mock, test } from "bun:test";

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
} from "./recycle-bin-summary";
import {
  changesFor,
  updateBucket,
  __resetChangesStoreForTests,
} from "@/features/changes/store";
import type { RecycleBinEntry } from "@/features/desktop/types";
import type { RetainedChange } from "@/lib/recycle-bin";
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

function deletion(repoKey: string, path: string): WorkingChange {
  return {
    id: crypto.randomUUID(),
    kind: "delete",
    entryKind: "file",
    path,
    origin: "manual",
    createdAt: Date.now(),
  };
}

beforeEach(() => {
  backing.clear();
  __resetChangesStoreForTests();
});

describe("recycleBinSummary", () => {
  test("counts kernel and domain entries and collects distinct repos", () => {
    const kernel = [kernelEntry(REPO_A, "a.ts"), kernelEntry(REPO_B, "b.ts")];
    const domain = [retainedEntry(REPO_A, "x.ts"), retainedEntry(REPO_A, "y.ts")];
    const summary = recycleBinSummary(kernel, domain);
    expect(summary.kernelCount).toBe(2);
    expect(summary.domainCount).toBe(2);
    expect(summary.repos.sort()).toEqual([REPO_A, REPO_B]);
  });

  test("empty inputs produce a zeroed summary", () => {
    const summary = recycleBinSummary([], []);
    expect(summary).toMatchObject({ kernelCount: 0, domainCount: 0, repos: [] });
  });
});

describe("emptyRecycleBinAll — unified Empty clears kernel and retained entries", () => {
  test("clears both kernel entries and per-repo retained entries", async () => {
    const kernel = [kernelEntry(REPO_A, "a.ts"), kernelEntry(REPO_B, "b.ts")];
    const domain = [retainedEntry(REPO_A, "x.ts"), retainedEntry(REPO_B, "y.ts")];

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

    expect(sessionCalls).toEqual(["kernel"]);
    expect(emptyBinCalls.sort()).toEqual([REPO_A, REPO_B]);
  });

  test("clears kernel entries even when no domain entries exist", async () => {
    const sessionCalls: string[] = [];
    const session: EmptyRecycleBinSession = {
      emptyRecycleBin: () => sessionCalls.push("kernel"),
    };
    const fakeEmptyBin = mock(() => Promise.resolve(0));

    await emptyRecycleBinAll({
      session,
      kernelEntries: [kernelEntry(REPO_A, "a.ts")],
      domainEntries: [],
      emptyBin: fakeEmptyBin as unknown as (r: string) => Promise<number>,
    });

    expect(sessionCalls).toEqual(["kernel"]);
    expect(fakeEmptyBin).not.toHaveBeenCalled();
  });

  test("does not call session.emptyRecycleBin when there are no kernel entries", async () => {
    const sessionCalls: string[] = [];
    const session: EmptyRecycleBinSession = {
      emptyRecycleBin: () => sessionCalls.push("kernel"),
    };
    const fakeEmptyBin = mock((r: string) => Promise.resolve(1));

    await emptyRecycleBinAll({
      session,
      kernelEntries: [],
      domainEntries: [retainedEntry(REPO_A, "x.ts")],
      emptyBin: fakeEmptyBin as unknown as (r: string) => Promise<number>,
    });

    expect(sessionCalls).toEqual([]);
    expect(fakeEmptyBin).toHaveBeenCalledTimes(1);
  });

  test("staged deletions in the working-changes bucket survive Empty", async () => {
    const staged = deletion(REPO_A, "removed.txt");
    updateBucket(REPO_A, (prev) => [...prev, staged]);

    const session: EmptyRecycleBinSession = { emptyRecycleBin: () => {} };
    const fakeEmptyBin = mock((r: string) => Promise.resolve(1));

    await emptyRecycleBinAll({
      session,
      kernelEntries: [kernelEntry(REPO_A, "a.ts")],
      domainEntries: [retainedEntry(REPO_A, "x.ts")],
      emptyBin: fakeEmptyBin as unknown as (r: string) => Promise<number>,
    });

    const remaining = changesFor(REPO_A).filter((c) => c.kind === "delete");
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(staged.id);
  });
});
