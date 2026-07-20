"use client";

import { useCallback, useSyncExternalStore } from "react";
import { useActiveRepo } from "@/lib/store";
import { useChanges } from "@/features/changes";
import { useWindowManager } from "@/features/desktop/WindowManagerProvider";
import {
  listRetained,
  listAllRetained,
  removeRetained,
  emptyBin,
  subscribeBin,
  GRACE_PERIOD_MS,
} from "@/lib/recycle-bin";
import { recycleBinSummary } from "./recycle-bin-summary";
import type { WorkingChange } from "@/lib/github-ops";
import { formatBytes } from "@/lib/github";
import { Trash, Undo, X, FileIcon } from "@/components/icons";

function useBinVersion(): number {
  // Simple change counter so the panel re-renders on bin mutations.
  return useSyncExternalStore(
    subscribeBin,
    () => binVersion,
    () => 0
  );
}
let binVersion = 0;
subscribeBinOnce();
function subscribeBinOnce() {
  if (typeof window === "undefined") return;
  subscribeBin(() => {
    binVersion++;
  });
}

function daysLeft(discardedAt: number): number {
  return Math.max(0, Math.ceil((discardedAt + GRACE_PERIOD_MS - Date.now()) / 86_400_000));
}

export function RecycleBinPanel({ onClose }: { onClose: () => void }) {
  const repo = useActiveRepo();
  const changes = useChanges();
  const wm = useWindowManager();
  useBinVersion();
  const repoKey = repo?.meta.fullName ?? null;

  // Staged deletions are rendered under "Staged deletions" and are
  // intentionally preserved — Empty Recycle Bin only clears the kernel
  // recycle-bin entries (discarded drafts from closed windows) and the
  // domain-retention entries (retained changes), never the changes bucket.
  const stagedDeletions = changes.changes.filter((c) => c.kind === "delete");
  const retained = repoKey ? listRetained(repoKey) : [];

  const kernelEntries = wm.session.recycleBin;
  const allRetained = listAllRetained();
  const summary = recycleBinSummary(kernelEntries, allRetained);

  const pathOccupied = useCallback(
    (path: string) =>
      changes.changes.some(
        (c) => c.path === path && (c.kind === "add" || c.kind === "modify" || c.kind === "rename")
      ),
    [changes.changes]
  );

  const restoreDeletion = (c: WorkingChange) => {
    if (pathOccupied(c.path)) {
      window.alert(
        `"${c.path}" is occupied by another pending change. Resolve that change first, then restore.`
      );
      return;
    }
    changes.discardChange(c.id); // removing the delete delta restores the file
  };

  const restoreRetained = async (entry: { change: WorkingChange }) => {
    let change = entry.change;
    if (pathOccupied(change.path)) {
      const next = window.prompt(
        `"${change.path}" is occupied by another pending change. Restore under a different path:`,
        change.path
      );
      if (!next || next === change.path) return;
      change = { ...change, kind: "add", path: next.replace(/^\/+/, "") };
    }
    changes.restoreChange(change);
    await removeRetained(entry.change.id, false);
  };

  const onEmpty = async () => {
    // Unified empty: clears BOTH the kernel recycle-bin entries (discarded
    // drafts from closed windows) and the domain-retention entries (retained
    // changes) across all repos. Staged deletions are intentionally preserved.
    if (summary.kernelCount === 0 && summary.domainCount === 0) return;
    if (
      !window.confirm(
        `${summary.kernelCount} discarded draft(s) from closed windows and ${summary.domainCount} retained change(s) across ${summary.repos.length} repo(s) will be permanently deleted. Staged deletions and Git history are not affected.`
      )
    )
      return;
    await wm.emptyRecycleBin();
    const retainedRepos = [...new Set(allRetained.map((r) => r.repoKey))];
    for (const rk of retainedRepos) {
      await emptyBin(rk);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-neutral-700 bg-neutral-900 shadow-2xl">
        <div className="flex items-center gap-2 border-b border-neutral-800 px-4 py-3">
          <Trash width={18} height={18} className="text-blue-400" />
          <h2 className="text-sm font-semibold text-neutral-100">
            Recycle Bin — {repoKey ?? "no repository"}
          </h2>
          <button
            onClick={onClose}
            className="ml-auto flex h-8 w-8 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
          >
            <X width={16} height={16} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <p className="text-xs text-neutral-500">
            Recoverable local states for this repository and variant. Git history
            is append-only — nothing here rewrites or erases checkpoints.
          </p>

          <section>
            <h3 className="mb-2 text-sm font-semibold text-neutral-200">
              Staged deletions <span className="text-neutral-500">({stagedDeletions.length})</span>
            </h3>
            {stagedDeletions.length === 0 ? (
              <p className="text-sm text-neutral-600">No files staged for deletion.</p>
            ) : (
              <ul className="rounded-lg border border-neutral-800">
                {stagedDeletions.map((c) => (
                  <li key={c.id} className="flex items-center gap-2 border-b border-neutral-800/60 px-3 py-1.5 text-sm last:border-0">
                    <Trash width={13} height={13} className="shrink-0 text-red-400" />
                    <span className="min-w-0 flex-1 truncate text-neutral-200" title={c.path}>
                      {c.path}
                    </span>
                    <span className="shrink-0 text-[11px] text-neutral-500">
                      {c.entryKind === "dir" ? "folder" : "file"} · deleted, not checkpointed
                    </span>
                    <button
                      onClick={() => restoreDeletion(c)}
                      className="flex shrink-0 items-center gap-1 rounded border border-neutral-700 px-2 py-0.5 text-xs text-neutral-300 hover:border-neutral-500"
                    >
                      <Undo width={12} height={12} /> Restore
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-1 text-[11px] text-neutral-600">
              Creating a checkpoint makes these deletions part of history; restoring
              afterwards creates a new change layer instead of rewriting the past.
            </p>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold text-neutral-200">
              Discarded drafts <span className="text-neutral-500">({retained.length})</span>
            </h3>
            {retained.length === 0 ? (
              <p className="text-sm text-neutral-600">No discarded drafts retained.</p>
            ) : (
              <ul className="rounded-lg border border-neutral-800">
                {retained.map((r) => (
                  <li key={r.change.id} className="flex items-center gap-2 border-b border-neutral-800/60 px-3 py-1.5 text-sm last:border-0">
                    <FileIcon width={13} height={13} className="shrink-0 text-sky-400" />
                    <span className="min-w-0 flex-1 truncate text-neutral-200" title={r.change.path}>
                      {r.change.path}
                    </span>
                    <span className="shrink-0 text-[11px] text-neutral-500">
                      {typeof r.change.size === "number" ? `${formatBytes(r.change.size)} · ` : ""}
                      {daysLeft(r.discardedAt)}d left
                    </span>
                    <button
                      onClick={() => void restoreRetained(r)}
                      className="flex shrink-0 items-center gap-1 rounded border border-neutral-700 px-2 py-0.5 text-xs text-neutral-300 hover:border-neutral-500"
                    >
                      <Undo width={12} height={12} /> Restore
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm(`Permanently delete the discarded draft of "${r.change.path}"?`)) {
                          void removeRetained(r.change.id, true);
                        }
                      }}
                      className="shrink-0 rounded border border-red-900 px-2 py-0.5 text-xs text-red-400 hover:bg-red-950/40"
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="flex items-center justify-end border-t border-neutral-800 px-4 py-3">
          <button
            onClick={() => void onEmpty()}
            disabled={summary.kernelCount === 0 && summary.domainCount === 0}
            className="rounded-md border border-red-800 px-3 py-1.5 text-sm text-red-300 hover:bg-red-950/40 disabled:opacity-40"
          >
            Empty Recycle Bin…
          </button>
        </div>
      </div>
    </div>
  );
}
