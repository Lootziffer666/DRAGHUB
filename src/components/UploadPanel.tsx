"use client";

import { useEffect, useRef, useState } from "react";
import { useActiveRepo, useStore } from "@/lib/store";
import { useStaging } from "@/lib/staging";
import { getGithubToken, setGithubToken } from "@/lib/github";
import { formatBytes } from "@/lib/github-write";
import {
  ArrowUploadRegular as Upload,
  DismissRegular as X,
  DocumentRegular as FileIcon,
  Spinner,
  FolderZipRegular as ArchiveIcon,
} from "@/features/icons";

export function UploadPanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { state } = useStore();
  const repo = useActiveRepo();
  const staging = useStaging();
  const meta = repo?.meta ?? null;

  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [baseDir, setBaseDir] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setToken(getGithubToken() ?? "");
  }, [open]);

  if (!open) return null;

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    await staging.addFiles(Array.from(fileList), baseDir.trim());
  }

  function saveToken() {
    setGithubToken(token);
  }

  const committing = staging.status === "committing";
  const processing = staging.status === "processing";
  const canCommit =
    meta &&
    staging.items.length > 0 &&
    token.trim().length > 0 &&
    !committing &&
    !processing;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-[var(--dh-window-border)] bg-[var(--dh-surface-raised)] shadow-2xl">
        <div className="flex items-center gap-2 border-b border-[var(--dh-window-border)] px-4 py-3">
          <Upload width={18} height={18} className="text-blue-700 dark:text-blue-400" />
          <h2 className="text-sm font-semibold text-[var(--dh-text)]">
            Upload to {meta ? meta.fullName : "repository"}
          </h2>
          <button
            onClick={onClose}
            className="ml-auto flex h-8 w-8 items-center justify-center rounded-md text-[var(--dh-text-secondary)] hover:bg-[var(--dh-surface-hover)] hover:text-[var(--dh-text)]"
          >
            <X width={16} height={16} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {!meta && (
            <div className="rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
              Open a repository first to enable uploads.
            </div>
          )}

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
                onClick={saveToken}
                className="rounded-md bg-[var(--dh-accent)] px-3 py-1.5 text-xs font-medium text-[var(--dh-accent-foreground)] hover:opacity-90"
              >
                Save
              </button>
            </div>
            {!token.trim() && (
              <p className="mt-1 text-xs text-[var(--dh-text-secondary)]">
                A token is required to commit. It is stored only in this browser.
              </p>
            )}
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              void handleFiles(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={[
              "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-8 text-center transition",
              dragOver
                ? "border-[var(--dh-accent)] bg-[var(--dh-accent)]/5"
                : "border-[var(--dh-window-border)] hover:border-[var(--dh-window-border-active)]",
            ].join(" ")}
          >
            <Upload width={26} height={26} className="text-[var(--dh-text-secondary)]" />
            <p className="mt-2 text-sm text-[var(--dh-text-secondary)]">
              Drop files or click to choose
            </p>
            <p className="mt-1 text-xs text-[var(--dh-text-secondary)]">
              zip, 7z and rar archives are extracted automatically
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                void handleFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-[var(--dh-text-secondary)]">
              Target folder
            </label>
            <input
              value={baseDir}
              onChange={(e) => setBaseDir(e.target.value)}
              placeholder="(repository root)"
              className="flex-1 rounded-md border border-[var(--dh-window-border)] bg-[var(--dh-surface-raised)] px-3 py-1.5 text-sm text-[var(--dh-text)] outline-none focus:border-[var(--dh-focus-ring)]"
            />
          </div>

          {processing && (
            <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
              <Spinner width={14} height={14} /> Extracting archives…
            </div>
          )}

          {staging.error && (
            <div className="rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 px-3 py-2 text-sm text-red-600 dark:text-red-300">
              {staging.error}
              <p className="mt-1 text-xs text-red-600/80 dark:text-red-400/80">
                Staged files are kept — fix the issue and try again.
              </p>
            </div>
          )}

          {staging.items.length > 0 && (
            <div className="rounded-lg border border-[var(--dh-window-border)]">
              <div className="flex items-center justify-between border-b border-[var(--dh-window-border)] px-3 py-2 text-xs text-[var(--dh-text-secondary)]">
                <span>
                  {staging.items.length} file
                  {staging.items.length === 1 ? "" : "s"} staged
                </span>
                <span>{formatBytes(staging.totalBytes)} total</span>
              </div>
              <ul className="max-h-52 overflow-y-auto">
                {staging.items.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center gap-2 border-b border-[var(--dh-window-border)]/60 px-3 py-1.5 last:border-0"
                  >
                    {item.source === "archive" ? (
                      <ArchiveIcon width={14} height={14} className="shrink-0 text-amber-700 dark:text-amber-400" />
                    ) : (
                      <FileIcon width={14} height={14} className="shrink-0 text-[var(--dh-text-secondary)]" />
                    )}
                    <span
                      className="min-w-0 flex-1 truncate text-sm text-[var(--dh-text)]"
                      title={item.path}
                    >
                      {item.path}
                    </span>
                    <span className="shrink-0 text-xs text-[var(--dh-text-secondary)]">
                      {formatBytes(item.size)}
                    </span>
                    <button
                      onClick={() => staging.removeItem(item.id)}
                      className="shrink-0 text-[var(--dh-text-secondary)] hover:text-red-600 dark:text-red-400"
                    >
                      <X width={14} height={14} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--dh-text-secondary)]">
                Branch
              </label>
              <input
                value={staging.options.branch}
                onChange={(e) => staging.setOptions({ branch: e.target.value })}
                placeholder={meta?.branch}
                className="w-full rounded-md border border-[var(--dh-window-border)] bg-[var(--dh-surface-raised)] px-3 py-1.5 text-sm text-[var(--dh-text)] outline-none focus:border-[var(--dh-focus-ring)]"
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-[var(--dh-text-secondary)]">
                <input
                  type="checkbox"
                  checked={staging.options.useLfs}
                  onChange={(e) => staging.setOptions({ useLfs: e.target.checked })}
                  className="h-4 w-4 rounded border-[var(--dh-window-border-active)] bg-[var(--dh-surface-raised)]"
                />
                Use Git LFS for large files
              </label>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--dh-text-secondary)]">
              Commit message
            </label>
            <input
              value={staging.options.message}
              onChange={(e) => staging.setOptions({ message: e.target.value })}
              className="w-full rounded-md border border-[var(--dh-window-border)] bg-[var(--dh-surface-raised)] px-3 py-1.5 text-sm text-[var(--dh-text)] outline-none focus:border-[var(--dh-focus-ring)]"
            />
          </div>

          {committing && staging.progress && (
            <div className="rounded-lg border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-950/30 px-3 py-2 text-sm text-blue-700 dark:text-blue-200">
              {staging.progress.message ?? "Committing…"} (
              {staging.progress.committedFiles}/
              {staging.progress.totalFiles} files, commit{" "}
              {staging.progress.currentCommit}/{staging.progress.totalCommits})
            </div>
          )}

          {staging.status === "done" && staging.summary && (
            <div className="rounded-lg border border-green-200 dark:border-green-900/50 bg-green-50 dark:bg-green-950/30 px-3 py-2 text-sm text-green-700 dark:text-green-300">
              Done — {staging.summary.commits} commit
              {staging.summary.commits === 1 ? "" : "s"} with{" "}
              {staging.summary.files} file
              {staging.summary.files === 1 ? "" : "s"}.
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-[var(--dh-window-border)] px-4 py-3">
          <button
            onClick={() => staging.clearAll()}
            disabled={staging.items.length === 0 || committing}
            className="rounded-md px-3 py-1.5 text-sm text-[var(--dh-text-secondary)] hover:bg-[var(--dh-surface-hover)] hover:text-[var(--dh-text)] disabled:opacity-40"
          >
            Clear cache
          </button>
          <button
            onClick={() => void staging.commit()}
            disabled={!canCommit}
            className="flex items-center gap-2 rounded-md bg-green-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {committing && <Spinner width={14} height={14} />}
            Commit {staging.items.length > 0 ? `(${staging.items.length})` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
