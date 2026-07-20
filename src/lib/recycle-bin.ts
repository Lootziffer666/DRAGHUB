import type { WorkingChange } from "./github-ops";
import { dbDelete } from "./staging-db";

/**
 * Recycle-bin retention for discarded content-bearing working changes
 * (docs/GITHUB_DESKTOP_SHELL_SPEC.md §14, DRAGHUB_PLAN_CORRECTION_RECORD.md §6).
 * Discarding a staged add/modify no longer destroys its content: the change
 * record moves here (its blob stays in IndexedDB) and can be restored for a
 * grace period. Emptying the bin — with an explicit confirmation — is what
 * finally releases the blobs. Git history is never touched.
 */

export type RetainedChange = {
  change: WorkingChange;
  repoKey: string;
  discardedAt: number;
};

const STORAGE_KEY = "draghub-recycle-bin";
export const GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000;

const listeners = new Set<() => void>();
let cache: RetainedChange[] | null = null;

function load(): RetainedChange[] {
  if (cache) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as RetainedChange[];
  } catch {
    cache = [];
  }
  return cache;
}

function save(items: RetainedChange[]) {
  cache = items;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

/** Retains a discarded change. Only content-bearing changes (with a blob)
 * are worth retaining — discarding a delete already restores the file. */
export function retainDiscarded(repoKey: string, change: WorkingChange): void {
  if (!change.blobId) return;
  const items = load();
  if (items.some((r) => r.change.id === change.id)) return;
  save([...items, { change, repoKey, discardedAt: Date.now() }]);
}

export function listRetained(repoKey: string): RetainedChange[] {
  void purgeExpired();
  return load().filter((r) => r.repoKey === repoKey);
}

/** Removes a retained entry (after restore, or per-item permanent delete).
 * `releaseBlob` permanently deletes the cached content. */
export async function removeRetained(changeId: string, releaseBlob: boolean): Promise<void> {
  const items = load();
  const entry = items.find((r) => r.change.id === changeId);
  if (!entry) return;
  if (releaseBlob && entry.change.blobId) await dbDelete(entry.change.blobId);
  save(items.filter((r) => r.change.id !== changeId));
}

/** Empties the bin for one repo — caller must have confirmed explicitly. */
export async function emptyBin(repoKey: string): Promise<number> {
  const items = load();
  const mine = items.filter((r) => r.repoKey === repoKey);
  for (const r of mine) {
    if (r.change.blobId) await dbDelete(r.change.blobId);
  }
  save(items.filter((r) => r.repoKey !== repoKey));
  return mine.length;
}

export async function purgeExpired(): Promise<void> {
  const items = load();
  const now = Date.now();
  const expired = items.filter((r) => now - r.discardedAt > GRACE_PERIOD_MS);
  if (expired.length === 0) return;
  for (const r of expired) {
    if (r.change.blobId) await dbDelete(r.change.blobId);
  }
  save(items.filter((r) => now - r.discardedAt <= GRACE_PERIOD_MS));
}

export function subscribeBin(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function retainedCount(repoKey: string): number {
  return load().filter((r) => r.repoKey === repoKey).length;
}
