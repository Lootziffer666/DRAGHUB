import type { WorkingChange } from "@/lib/github-ops";

/**
 * Module-level store for pending working changes, bucketed per repository.
 *
 * The desktop shell mounts one ChangesProvider per repository window, and the
 * Recycle Bin window, taskbar badges and the window-close lifecycle adapter
 * all need to read (and sometimes mutate) buckets for arbitrary repositories
 * without a React provider in scope. Keeping the buckets here — instead of in
 * one provider instance keyed to a global "active" repository — is what makes
 * per-window repository isolation possible (POST_PR8_REFERENCE_INTEGRATION
 * "Mandatory repository-state rule").
 */

const META_KEY = "gh-browser-changes-by-repo";
const EMPTY: WorkingChange[] = [];

let cache: Record<string, WorkingChange[]> | null = null;
// Referentially stable until the next mutation — `repoKeysWithChanges()` is
// used directly as a `useSyncExternalStore` snapshot (the launcher's
// adaptive "unsaved working changes" widget), which requires the same array
// reference across renders when nothing changed, or React re-renders
// infinitely believing the snapshot keeps changing.
let repoKeysCache: string[] | null = null;
const listeners = new Set<() => void>();

function loadAll(): Record<string, WorkingChange[]> {
  if (cache) return cache;
  cache = {};
  try {
    if (typeof localStorage !== "undefined") {
      const parsed = JSON.parse(localStorage.getItem(META_KEY) ?? "{}");
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        cache = parsed as Record<string, WorkingChange[]>;
      }
    }
  } catch {
    /* ignore */
  }
  return cache;
}

function persist() {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(META_KEY, JSON.stringify(cache ?? {}));
    }
  } catch {
    /* ignore */
  }
}

function notify() {
  listeners.forEach((l) => l());
}

/** Referentially stable snapshot of one repository's pending changes. */
export function changesFor(repoKey: string | null): WorkingChange[] {
  if (!repoKey) return EMPTY;
  return loadAll()[repoKey] ?? EMPTY;
}

export function pendingCount(repoKey: string | null): number {
  return changesFor(repoKey).length;
}

/** Every repo key that currently has at least one pending change.
 * Referentially stable between mutations — see `repoKeysCache` above. */
export function repoKeysWithChanges(): string[] {
  if (repoKeysCache) return repoKeysCache;
  const all = loadAll();
  repoKeysCache = Object.keys(all).filter((k) => (all[k] ?? []).length > 0);
  return repoKeysCache;
}

export function updateBucket(
  repoKey: string,
  fn: (prev: WorkingChange[]) => WorkingChange[]
): void {
  const all = loadAll();
  const prev = all[repoKey] ?? EMPTY;
  const next = fn(prev);
  if (next === prev) return;
  all[repoKey] = next;
  persist();
  repoKeysCache = null;
  notify();
}

export function subscribeChanges(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Test hook: reset the in-memory cache so the next read hits storage. */
export function __resetChangesStoreForTests(): void {
  cache = null;
  repoKeysCache = null;
}
