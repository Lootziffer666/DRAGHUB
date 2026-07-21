import type { RecycleBinEntry } from "@/features/desktop/types";
import type { RetainedChange } from "@/lib/recycle-bin";

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
 * Pure summary of both KERNEL recycle-bin entries (drafts discarded from closed
 * windows, held in wm.session.recycleBin) and DOMAIN-retention entries
 * (listAllRetained()). Staged deletions live in the working-changes bucket and
 * are intentionally NOT counted here — Empty Recycle Bin must never touch them.
 */
export function recycleBinSummary(
  recycleBin: RecycleBinEntry[],
  retained: RetainedChange[],
): RecycleBinSummary {
  const kernelCount = recycleBin.length;
  const domainCount = retained.length;

  const repoSet = new Set<string>();
  for (const e of recycleBin) {
    if (e.repoKey) repoSet.add(e.repoKey);
  }
  for (const r of retained) {
    if (r.repoKey) repoSet.add(r.repoKey);
  }

  let totalBytes = 0;
  for (const e of recycleBin) {
    if (e.kind === "draft") totalBytes += byteLength(e.payload.content);
    else totalBytes += byteLength(e.payload.content);
  }
  for (const r of retained) {
    totalBytes += r.change.size ?? 0;
  }

  return {
    kernelCount,
    domainCount,
    repos: [...repoSet],
    totalBytes,
  };
}
