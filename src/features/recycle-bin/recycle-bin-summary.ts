import type { RecycleBinEntry } from "@/features/desktop/types";
import { emptyBin as defaultEmptyBin, type RetainedChange } from "@/lib/recycle-bin";

/**
 * Minimal session contract needed to empty the KERNEL recycle-bin entries
 * (discarded drafts from closed windows, held in `wm.session.recycleBin`).
 * The domain-retention entries are cleared by `emptyBin` per repository.
 */
export type EmptyRecycleBinSession = {
  emptyRecycleBin: () => void;
};

export type RecycleBinSummary = {
  kernelCount: number;
  domainCount: number;
  repos: string[];
  totalBytes: number;
};

function byteLength(s: string | undefined): number {
  if (!s) return 0;
  if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(s).length;
  return s.length;
}

/**
 * Pure summary of both KERNEL recycle-bin entries (drafts discarded from
 * closed windows) and DOMAIN-retention entries (discarded working changes).
 * Staged deletions live in the working-changes bucket and are intentionally
 * NOT counted here — Empty Recycle Bin must never touch them.
 */
export function recycleBinSummary(
  recycleBin: RecycleBinEntry[],
  retained: RetainedChange[],
): RecycleBinSummary {
  const repoSet = new Set<string>();
  for (const e of recycleBin) {
    if (e.repoKey) repoSet.add(e.repoKey);
  }
  for (const r of retained) {
    if (r.repoKey) repoSet.add(r.repoKey);
  }

  let totalBytes = 0;
  for (const e of recycleBin) {
    totalBytes += byteLength(e.payload.content);
  }
  for (const r of retained) {
    totalBytes += r.change.size ?? 0;
  }

  return {
    kernelCount: recycleBin.length,
    domainCount: retained.length,
    repos: [...repoSet],
    totalBytes,
  };
}

/**
 * Unified Recycle Bin empty. Clears BOTH the KERNEL entries (via
 * `session.emptyRecycleBin()`) and the DOMAIN-retention entries (via
 * `emptyBin` per repository that has retained changes). `emptyBin` is
 * injectable so the behavior is unit-testable without touching IndexedDB.
 * Staged deletions live in the working-changes bucket and are intentionally
 * never touched here.
 */
export async function emptyRecycleBinAll(params: {
  session: EmptyRecycleBinSession;
  kernelEntries: RecycleBinEntry[];
  domainEntries: RetainedChange[];
  emptyBin?: (repoKey: string) => Promise<number>;
}): Promise<void> {
  const { session, kernelEntries, domainEntries } = params;
  const emptyBin = params.emptyBin ?? defaultEmptyBin;

  if (kernelEntries.length > 0) session.emptyRecycleBin();
  const retainedRepos = [...new Set(domainEntries.map((r) => r.repoKey))];
  for (const rk of retainedRepos) {
    await emptyBin(rk);
  }
}
