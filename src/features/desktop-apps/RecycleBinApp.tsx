"use client";

import { useEffect, useReducer, useState } from "react";
import { useWindowManager } from "@/features/desktop/WindowManagerProvider";
import {
  changesFor,
  repoKeysWithChanges,
  subscribeChanges,
  updateBucket,
} from "@/features/changes/store";
import {
  listAllRetained,
  removeRetained,
  subscribeBin,
  GRACE_PERIOD_MS,
  type RetainedChange,
} from "@/lib/recycle-bin";
import { emptyRecycleBinAll, recycleBinSummary } from "@/features/recycle-bin/recycle-bin-summary";
import type { WorkingChange } from "@/lib/github-ops";
import { formatBytes } from "@/lib/github";
import { events } from "@/lib/events";
import { Trash, Undo, FileIcon } from "@/components/icons";

function daysLeft(discardedAt: number): number {
  return Math.max(0, Math.ceil((discardedAt + GRACE_PERIOD_MS - Date.now()) / 86_400_000));
}

/**
 * The system Recycle Bin application — one window over every recoverable
 * local state (GITHUB_DESKTOP_SHELL_SPEC §14, correction record §6):
 * drafts discarded by the window-close lifecycle (kernel entries, restored
 * through the lifecycle adapter), staged deletions per repository, and
 * discarded content-bearing working changes retained for a grace period.
 * Git history is append-only; nothing here rewrites checkpoints, and
 * emptying requires a summary + explicit confirmation.
 */
export function RecycleBinApp() {
  const wm = useWindowManager();
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => subscribeChanges(force), []);
  useEffect(() => subscribeBin(force), []);

  const kernelEntries = wm.session.recycleBin;
  const deletionsByRepo = repoKeysWithChanges()
    .map((repoKey) => ({
      repoKey,
      deletions: changesFor(repoKey).filter((c) => c.kind === "delete"),
    }))
    .filter((r) => r.deletions.length > 0);
  const retained = listAllRetained();

  const pathOccupied = (repoKey: string, path: string) =>
    changesFor(repoKey).some(
      (c) => c.path === path && (c.kind === "add" || c.kind === "modify" || c.kind === "rename")
    );

  const restoreDeletion = (repoKey: string, c: WorkingChange) => {
    if (pathOccupied(repoKey, c.path)) {
      window.alert(
        `"${c.path}" is occupied by another pending change in ${repoKey}. Resolve that change first, then restore.`
      );
      return;
    }
    // Removing the delete delta restores the file in the overlay.
    updateBucket(repoKey, (prev) => prev.filter((x) => x.id !== c.id));
    events.emit("change.discarded", { path: c.path });
  };

  const restoreRetained = async (entry: RetainedChange) => {
    let change = entry.change;
    if (pathOccupied(entry.repoKey, change.path)) {
      const next = window.prompt(
        `"${change.path}" is occupied by another pending change in ${entry.repoKey}. Restore under a different path:`,
        change.path
      );
      if (!next || next === change.path) return;
      change = { ...change, kind: "add", path: next.replace(/^\/+/, "") };
    }
    const restored = change;
    updateBucket(entry.repoKey, (prev) =>
      prev.some((c) => c.id === restored.id) ? prev : [...prev, restored]
    );
    events.emit("change.staged", { kind: restored.kind, path: restored.path });
    await removeRetained(entry.change.id, false);
  };

  const summary = recycleBinSummary(kernelEntries, retained);

  const onEmpty = async () => {
    // Unified empty: clears BOTH kernel recycle-bin entries (discarded
    // drafts from closed windows) and domain-retention entries (retained
    // changes) per repo. Staged deletions are intentionally preserved.
    if (summary.kernelCount === 0 && summary.domainCount === 0) return;
    if (
      !window.confirm(
        `Empty the Recycle Bin?\n\n${summary.kernelCount} discarded draft${summary.kernelCount === 1 ? "" : "s"} from closed windows and ${summary.domainCount} retained change${summary.domainCount === 1 ? "" : "s"} across ${summary.repos.length} repositor${summary.repos.length === 1 ? "y" : "ies"} will be permanently deleted. Staged deletions and Git history are not affected.`
      )
    )
      return;
    await emptyRecycleBinAll({
      session: wm,
      kernelEntries,
      domainEntries: retained,
    });
  };

  const [busyEntry, setBusyEntry] = useState<string | null>(null);

  return (
    <div className="flex h-full flex-col bg-[var(--dh-surface)] text-[var(--dh-text)]">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <p className="text-xs text-[var(--dh-text-secondary)]">
          Recoverable local states. Git history is append-only — nothing here
          rewrites or erases checkpoints, and closing a window never deletes a
          repository or its desktop shortcut.
        </p>

        <section>
          <h3 className="mb-2 text-sm font-semibold text-[var(--dh-text)]">
            Discarded on window close{" "}
            <span className="text-[var(--dh-text-secondary)]">({kernelEntries.length})</span>
          </h3>
          {wm.session.recycleError && (
            <p className="mb-2 rounded border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-2 text-xs text-red-600 dark:text-red-300">
              {wm.session.recycleError}
            </p>
          )}
          {kernelEntries.length === 0 ? (
            <p className="text-sm text-[var(--dh-text-disabled)]">No drafts from closed windows.</p>
          ) : (
            <ul className="rounded-lg border border-[var(--dh-window-border)]">
              {kernelEntries.map((e) => (
                <li
                  key={e.id}
                  className="flex items-center gap-2 border-b border-[var(--dh-window-border)]/60 px-3 py-1.5 text-sm last:border-0"
                >
                  <FileIcon width={13} height={13} className="shrink-0 text-amber-700 dark:text-amber-400" />
                  <span className="min-w-0 flex-1 truncate" title={e.label}>
                    {e.label}
                  </span>
                  <span className="shrink-0 text-[11px] text-[var(--dh-text-secondary)]">
                    {e.repoKey ?? "—"}
                  </span>
                  <button
                    disabled={busyEntry === e.id}
                    onClick={() => {
                      setBusyEntry(e.id);
                      Promise.resolve(wm.restoreRecycleEntry(e.id)).finally(() =>
                        setBusyEntry(null)
                      );
                    }}
                    className="flex shrink-0 items-center gap-1 rounded border border-[var(--dh-window-border)] px-2 py-0.5 text-xs text-[var(--dh-text-secondary)] hover:border-[var(--dh-window-border-active)] disabled:opacity-40"
                  >
                    <Undo width={12} height={12} /> Restore draft
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(`Permanently delete "${e.label}"?`))
                        wm.deleteRecycleEntry(e.id);
                    }}
                    className="shrink-0 rounded border border-red-200 dark:border-red-900 px-2 py-0.5 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:bg-red-950/40"
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-1 text-[11px] text-[var(--dh-text-disabled)]">
            Restoring re-creates the unsaved draft in its file&apos;s editor session.
          </p>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold text-[var(--dh-text)]">
            Staged deletions{" "}
            <span className="text-[var(--dh-text-secondary)]">
              ({deletionsByRepo.reduce((s, r) => s + r.deletions.length, 0)})
            </span>
          </h3>
          {deletionsByRepo.length === 0 ? (
            <p className="text-sm text-[var(--dh-text-disabled)]">No files staged for deletion.</p>
          ) : (
            deletionsByRepo.map(({ repoKey, deletions }) => (
              <ul key={repoKey} className="mb-2 rounded-lg border border-[var(--dh-window-border)]">
                {deletions.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center gap-2 border-b border-[var(--dh-window-border)]/60 px-3 py-1.5 text-sm last:border-0"
                  >
                    <Trash width={13} height={13} className="shrink-0 text-red-600 dark:text-red-400" />
                    <span className="min-w-0 flex-1 truncate" title={c.path}>
                      {c.path}
                    </span>
                    <span className="shrink-0 text-[11px] text-[var(--dh-text-secondary)]">
                      {repoKey} · {c.entryKind === "dir" ? "folder" : "file"}
                    </span>
                    <button
                      onClick={() => restoreDeletion(repoKey, c)}
                      className="flex shrink-0 items-center gap-1 rounded border border-[var(--dh-window-border)] px-2 py-0.5 text-xs text-[var(--dh-text-secondary)] hover:border-[var(--dh-window-border-active)]"
                    >
                      <Undo width={12} height={12} /> Restore
                    </button>
                  </li>
                ))}
              </ul>
            ))
          )}
          <p className="mt-1 text-[11px] text-[var(--dh-text-disabled)]">
            A checkpoint makes deletions part of history; restoring afterwards
            creates a new change layer instead of rewriting the past.
          </p>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold text-[var(--dh-text)]">
            Discarded drafts{" "}
            <span className="text-[var(--dh-text-secondary)]">({retained.length})</span>
          </h3>
          {retained.length === 0 ? (
            <p className="text-sm text-[var(--dh-text-disabled)]">No discarded drafts retained.</p>
          ) : (
            <ul className="rounded-lg border border-[var(--dh-window-border)]">
              {retained.map((r) => (
                <li
                  key={r.change.id}
                  className="flex items-center gap-2 border-b border-[var(--dh-window-border)]/60 px-3 py-1.5 text-sm last:border-0"
                >
                  <FileIcon width={13} height={13} className="shrink-0 text-sky-700 dark:text-sky-400" />
                  <span className="min-w-0 flex-1 truncate" title={r.change.path}>
                    {r.change.path}
                  </span>
                  <span className="shrink-0 text-[11px] text-[var(--dh-text-secondary)]">
                    {r.repoKey}
                    {typeof r.change.size === "number"
                      ? ` · ${formatBytes(r.change.size)}`
                      : ""}{" "}
                    · {daysLeft(r.discardedAt)}d left
                  </span>
                  <button
                    onClick={() => void restoreRetained(r)}
                    className="flex shrink-0 items-center gap-1 rounded border border-[var(--dh-window-border)] px-2 py-0.5 text-xs text-[var(--dh-text-secondary)] hover:border-[var(--dh-window-border-active)]"
                  >
                    <Undo width={12} height={12} /> Restore
                  </button>
                  <button
                    onClick={() => {
                      if (
                        window.confirm(
                          `Permanently delete the discarded draft of "${r.change.path}"?`
                        )
                      )
                        void removeRetained(r.change.id, true);
                    }}
                    className="shrink-0 rounded border border-red-200 dark:border-red-900 px-2 py-0.5 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:bg-red-950/40"
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="flex items-center justify-end border-t border-[var(--dh-window-border)] px-4 py-3">
        <button
          onClick={() => void onEmpty()}
          disabled={summary.kernelCount === 0 && summary.domainCount === 0}
          className="rounded-md border border-red-200 dark:border-red-800 px-3 py-1.5 text-sm text-red-600 dark:text-red-300 hover:bg-red-50 dark:bg-red-950/40 disabled:opacity-40"
        >
          Empty Recycle Bin…
        </button>
      </div>
    </div>
  );
}
