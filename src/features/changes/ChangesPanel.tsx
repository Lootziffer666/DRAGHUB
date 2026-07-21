"use client";

import { useEffect, useState } from "react";
import { useActiveRepo } from "@/lib/store";
import { useChanges } from "./changes";
import { getGithubToken, setGithubToken } from "@/lib/github";
import { formatBytes } from "@/lib/github-write";
import {
  DocumentAddRegular as FilePlus,
  RecordRegular as GitCommit,
  Spinner,
  DeleteRegular as Trash,
  EditRegular as Edit,
  DismissRegular as X,
} from "@/features/icons";
import type { ChangeKind } from "@/lib/github-ops";

function kindIcon(kind: ChangeKind) {
  if (kind === "add") return <FilePlus width={14} height={14} className="shrink-0 text-emerald-700 dark:text-emerald-400" />;
  if (kind === "modify") return <Edit width={14} height={14} className="shrink-0 text-amber-700 dark:text-amber-400" />;
  if (kind === "delete") return <Trash width={14} height={14} className="shrink-0 text-red-600 dark:text-red-400" />;
  return <Edit width={14} height={14} className="shrink-0 text-blue-700 dark:text-blue-400" />;
}

function kindLabel(kind: ChangeKind): string {
  if (kind === "add") return "New";
  if (kind === "modify") return "Modify";
  if (kind === "delete") return "Delete";
  return "Rename";
}

export function ChangesPanel({ onClose }: { onClose: () => void }) {
  const repo = useActiveRepo();
  const meta = repo?.meta ?? null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-[var(--dh-window-border)] bg-[color-mix(in_srgb,var(--dh-surface-raised)_85%,transparent)] shadow-2xl backdrop-blur-2xl backdrop-saturate-150">
        <div className="flex items-center gap-2 border-b border-[var(--dh-window-border)] px-4 py-3">
          <GitCommit width={18} height={18} className="text-blue-700 dark:text-blue-400" />
          <h2 className="text-sm font-semibold text-[var(--dh-text)]">
            Working changes — {meta ? meta.fullName : "repository"}
          </h2>
          <button
            onClick={onClose}
            className="ml-auto flex h-8 w-8 items-center justify-center rounded-md text-[var(--dh-text-secondary)] hover:bg-[var(--dh-surface-hover)] hover:text-[var(--dh-text)]"
          >
            <X width={16} height={16} />
          </button>
        </div>
        <ChangesPanelBody />
      </div>
    </div>
  );
}

/** The working-changes list + checkpoint controls, reusable both inside the
 * modal panel and as the content of a desktop "Changes" child window. */
export function ChangesPanelBody() {
  const repo = useActiveRepo();
  const changes = useChanges();
  const meta = repo?.meta ?? null;

  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);

  useEffect(() => {
    setToken(getGithubToken() ?? "");
  }, []);

  const committing = changes.status === "committing";
  const canCommit =
    !!meta && changes.changes.length > 0 && token.trim().length > 0 && !committing;

  return (
    <>
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {!token.trim() && (
            <div className="rounded-lg border border-[var(--dh-window-border)] bg-[var(--dh-surface)] p-3">
              <label className="mb-1 block text-xs font-medium text-[var(--dh-text-secondary)]">
                GitHub token (PAT, needs repo scope)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type={showToken ? "text" : "password"}
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="ghp_…"
                  className="flex-1 rounded-md border border-[var(--dh-window-border)] bg-[var(--dh-surface-raised)] px-3 py-1.5 text-sm text-[var(--dh-text)] outline-none focus:border-[var(--dh-focus-ring)]"
                />
                <button
                  onClick={() => setShowToken((v) => !v)}
                  className="rounded-md border border-[var(--dh-window-border)] px-2 py-1.5 text-xs text-[var(--dh-text-secondary)] hover:border-[var(--dh-window-border-active)]"
                >
                  {showToken ? "Hide" : "Show"}
                </button>
                <button
                  onClick={() => setGithubToken(token)}
                  className="rounded-md bg-[var(--dh-accent)] px-3 py-1.5 text-xs font-medium text-[var(--dh-accent-foreground)] hover:opacity-90"
                >
                  Save
                </button>
              </div>
            </div>
          )}

          <div className="text-xs text-[var(--dh-text-secondary)]">
            Comparing against <span className="text-[var(--dh-text-secondary)]">{meta?.branch}</span> —
            each row is an uncommitted delta. Create a checkpoint to commit all of
            them in one go.
          </div>

          {changes.error && (
            <div className="rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 px-3 py-2 text-sm text-red-600 dark:text-red-300">
              {changes.error}
            </div>
          )}

          {changes.changes.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--dh-window-border)] px-4 py-8 text-center text-sm text-[var(--dh-text-disabled)]">
              No pending changes. Use the Explorer&apos;s context menu (New file,
              New folder, Rename, Delete) or drag an item onto a folder to move
              it.
            </div>
          ) : (
            <div className="rounded-lg border border-[var(--dh-window-border)]">
              <ul className="max-h-72 overflow-y-auto">
                {changes.changes.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center gap-2 border-b border-[var(--dh-window-border)]/60 px-3 py-1.5 last:border-0"
                  >
                    {kindIcon(c.kind)}
                    <span className="w-16 shrink-0 text-xs text-[var(--dh-text-secondary)]">
                      {kindLabel(c.kind)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-[var(--dh-text)]" title={c.path}>
                      {c.kind === "rename" ? (
                        <>
                          <span className="text-[var(--dh-text-secondary)]">{c.fromPath}</span>
                          {" → "}
                          {c.path}
                        </>
                      ) : (
                        c.path
                      )}
                    </span>
                    {typeof c.size === "number" &&
                      (c.kind === "add" || c.kind === "modify") &&
                      c.entryKind === "file" && (
                      <span className="shrink-0 text-xs text-[var(--dh-text-secondary)]">
                        {formatBytes(c.size)}
                      </span>
                    )}
                    <button
                      onClick={() => changes.discardChange(c.id)}
                      title="Discard"
                      className="shrink-0 text-[var(--dh-text-secondary)] hover:text-red-600 dark:hover:text-red-400"
                    >
                      <X width={14} height={14} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--dh-text-secondary)]">
              Checkpoint message
            </label>
            <input
              value={changes.message}
              onChange={(e) => changes.setMessage(e.target.value)}
              className="w-full rounded-md border border-[var(--dh-window-border)] bg-[var(--dh-surface-raised)] px-3 py-1.5 text-sm text-[var(--dh-text)] outline-none focus:border-[var(--dh-focus-ring)]"
            />
          </div>

          {changes.status === "done" && (
            <div className="rounded-lg border border-green-200 dark:border-green-900/50 bg-green-50 dark:bg-green-950/30 px-3 py-2 text-sm text-green-700 dark:text-green-300">
              Checkpoint created.
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-[var(--dh-window-border)] px-4 py-3">
          <button
            onClick={() => changes.discardAll()}
            disabled={changes.changes.length === 0 || committing}
            className="rounded-md px-3 py-1.5 text-sm text-[var(--dh-text-secondary)] hover:bg-[var(--dh-surface-hover)] hover:text-[var(--dh-text)] disabled:opacity-40"
          >
            Discard all
          </button>
          <button
            onClick={() => void changes.createCheckpoint()}
            disabled={!canCommit}
            className="flex items-center gap-2 rounded-md bg-green-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {committing && <Spinner width={14} height={14} />}
            Create checkpoint{" "}
            {changes.changes.length > 0 ? `(${changes.changes.length})` : ""}
          </button>
        </div>
    </>
  );
}
