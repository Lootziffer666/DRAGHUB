"use client";

import { useEffect, useState } from "react";
import { useActiveRepo } from "@/lib/store";
import { useChanges } from "./changes";
import { getGithubToken, setGithubToken } from "@/lib/github";
import { formatBytes } from "@/lib/github-write";
import {
  FilePlus,
  GitCommit,
  Spinner,
  Trash,
  Edit,
  X,
} from "@/components/icons";
import type { ChangeKind } from "@/lib/github-ops";

function kindIcon(kind: ChangeKind) {
  if (kind === "add") return <FilePlus width={14} height={14} className="shrink-0 text-emerald-400" />;
  if (kind === "modify") return <Edit width={14} height={14} className="shrink-0 text-amber-400" />;
  if (kind === "delete") return <Trash width={14} height={14} className="shrink-0 text-red-400" />;
  return <Edit width={14} height={14} className="shrink-0 text-blue-400" />;
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-neutral-700 bg-neutral-900 shadow-2xl">
        <div className="flex items-center gap-2 border-b border-neutral-800 px-4 py-3">
          <GitCommit width={18} height={18} className="text-blue-400" />
          <h2 className="text-sm font-semibold text-neutral-100">
            Working changes — {meta ? meta.fullName : "repository"}
          </h2>
          <button
            onClick={onClose}
            className="ml-auto flex h-8 w-8 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
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
            <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-3">
              <label className="mb-1 block text-xs font-medium text-neutral-400">
                GitHub token (PAT, needs repo scope)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type={showToken ? "text" : "password"}
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="ghp_…"
                  className="flex-1 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-100 outline-none focus:border-blue-600"
                />
                <button
                  onClick={() => setShowToken((v) => !v)}
                  className="rounded-md border border-neutral-700 px-2 py-1.5 text-xs text-neutral-300 hover:border-neutral-600"
                >
                  {showToken ? "Hide" : "Show"}
                </button>
                <button
                  onClick={() => setGithubToken(token)}
                  className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
                >
                  Save
                </button>
              </div>
            </div>
          )}

          <div className="text-xs text-neutral-500">
            Comparing against <span className="text-neutral-300">{meta?.branch}</span> —
            each row is an uncommitted delta. Create a checkpoint to commit all of
            them in one go.
          </div>

          {changes.error && (
            <div className="rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-300">
              {changes.error}
            </div>
          )}

          {changes.changes.length === 0 ? (
            <div className="rounded-lg border border-dashed border-neutral-800 px-4 py-8 text-center text-sm text-neutral-600">
              No pending changes. Use the Explorer&apos;s context menu (New file,
              New folder, Rename, Delete) or drag an item onto a folder to move
              it.
            </div>
          ) : (
            <div className="rounded-lg border border-neutral-800">
              <ul className="max-h-72 overflow-y-auto">
                {changes.changes.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center gap-2 border-b border-neutral-800/60 px-3 py-1.5 last:border-0"
                  >
                    {kindIcon(c.kind)}
                    <span className="w-16 shrink-0 text-xs text-neutral-500">
                      {kindLabel(c.kind)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-neutral-200" title={c.path}>
                      {c.kind === "rename" ? (
                        <>
                          <span className="text-neutral-500">{c.fromPath}</span>
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
                      <span className="shrink-0 text-xs text-neutral-500">
                        {formatBytes(c.size)}
                      </span>
                    )}
                    <button
                      onClick={() => changes.discardChange(c.id)}
                      title="Discard"
                      className="shrink-0 text-neutral-500 hover:text-red-400"
                    >
                      <X width={14} height={14} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-400">
              Checkpoint message
            </label>
            <input
              value={changes.message}
              onChange={(e) => changes.setMessage(e.target.value)}
              className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-100 outline-none focus:border-blue-600"
            />
          </div>

          {changes.status === "done" && (
            <div className="rounded-lg border border-green-900/50 bg-green-950/30 px-3 py-2 text-sm text-green-300">
              Checkpoint created.
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-neutral-800 px-4 py-3">
          <button
            onClick={() => changes.discardAll()}
            disabled={changes.changes.length === 0 || committing}
            className="rounded-md px-3 py-1.5 text-sm text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100 disabled:opacity-40"
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
