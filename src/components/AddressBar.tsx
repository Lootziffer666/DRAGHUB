"use client";

import { useEffect, useRef, useState } from "react";
import { useActiveRepo, useRepoRequest, useStore } from "@/lib/store";
import { fetchBranches } from "@/lib/github";
import {
  ChevronDown,
  ExternalLink,
  GitBranch,
  Home,
  Search,
  Spinner,
  Star,
  Upload,
  X,
} from "./icons";
import { UploadPanel } from "./UploadPanel";

export function AddressBar({
  onGoHome,
  onOpenRepo,
  onCloseRepo,
}: {
  onGoHome: () => void;
  /** Overrides how a typed/recent repository is opened — the desktop shell
   * routes this into a new repository window instead of the global store. */
  onOpenRepo?: (input: string) => void;
  onCloseRepo?: () => void;
}) {
  const { openRepo, setBranch, closeRepo } = useStore();
  const repo = useActiveRepo();
  const request = useRepoRequest(repo?.meta.fullName ?? null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [value, setValue] = useState("");
  const [branches, setBranches] = useState<string[]>([]);
  const [branchOpen, setBranchOpen] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [showRecent, setShowRecent] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const meta = repo?.meta ?? null;

  useEffect(() => {
    if (meta) {
      fetchBranches(meta.owner, meta.repo)
        .then(setBranches)
        .catch(() => setBranches([meta.branch]));
    } else {
      setBranches([]);
    }
  }, [meta]);

  useEffect(() => {
    try {
      setRecent(JSON.parse(localStorage.getItem("gh-browser-recent") ?? "[]"));
    } catch {
      setRecent([]);
    }
  }, [request.loading]);

  const open = (input: string) => {
    if (onOpenRepo) onOpenRepo(input);
    else void openRepo(input);
  };

  function submit() {
    if (!value.trim()) return;
    open(value);
    setShowRecent(false);
    inputRef.current?.blur();
  }

  return (
    <div className="flex items-center gap-2 border-b border-[var(--dh-window-border)] bg-[var(--dh-surface-raised)] px-3 py-2">
      <button
        onClick={onGoHome}
        title="Home"
        className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--dh-text-secondary)] hover:bg-[var(--dh-surface-hover)] hover:text-[var(--dh-text)]"
      >
        <Home width={18} height={18} />
      </button>

      <div className="relative flex-1">
        <div className="flex items-center gap-2 rounded-md border border-[var(--dh-window-border)] bg-[var(--dh-surface)] px-3 py-1.5 focus-within:border-[var(--dh-focus-ring)]">
          <Search width={15} height={15} className="text-[var(--dh-text-secondary)]" />
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={() => setShowRecent(true)}
            onBlur={() => setTimeout(() => setShowRecent(false), 120)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
              if (e.key === "Escape") inputRef.current?.blur();
            }}
            placeholder={
              meta ? `${meta.fullName}` : "Open a repository — e.g. facebook/react"
            }
            className="flex-1 bg-transparent text-sm text-[var(--dh-text)] outline-none placeholder:text-[var(--dh-text-disabled)]"
            spellCheck={false}
          />
          {request.loading && (
            <Spinner width={15} height={15} className="text-blue-700 dark:text-blue-400" />
          )}
          {value && (
            <button
              onClick={() => setValue("")}
              className="text-[var(--dh-text-secondary)] hover:text-[var(--dh-text)]"
            >
              <X width={14} height={14} />
            </button>
          )}
        </div>
        {showRecent && recent.length > 0 && !meta && (
          <div className="absolute z-40 mt-1 w-full overflow-hidden rounded-md border border-[var(--dh-window-border)] bg-[var(--dh-surface-raised)] shadow-xl">
            {recent.map((r) => (
              <button
                key={r}
                onMouseDown={(e) => {
                  e.preventDefault();
                  setValue(r);
                  open(r);
                  setShowRecent(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--dh-text)] hover:bg-[var(--dh-surface-hover)]"
              >
                <GitBranch width={14} height={14} className="text-[var(--dh-text-secondary)]" />
                {r}
              </button>
            ))}
          </div>
        )}
      </div>

      {meta && (
        <>
          <div className="relative">
            <button
              onClick={() => setBranchOpen((v) => !v)}
              onBlur={() => setTimeout(() => setBranchOpen(false), 150)}
              className="flex items-center gap-1.5 rounded-md border border-[var(--dh-window-border)] bg-[var(--dh-surface)] px-2.5 py-1.5 text-sm text-[var(--dh-text)] hover:border-[var(--dh-window-border-active)]"
            >
              <GitBranch width={14} height={14} className="text-blue-700 dark:text-blue-400" />
              <span className="max-w-[140px] truncate">{meta.branch}</span>
              <ChevronDown width={14} height={14} className="text-[var(--dh-text-secondary)]" />
            </button>
            {branchOpen && (
              <div className="absolute right-0 z-40 mt-1 max-h-72 w-56 overflow-auto rounded-md border border-[var(--dh-window-border)] bg-[var(--dh-surface-raised)] py-1 shadow-xl">
                {branches.map((b) => (
                  <button
                    key={b}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setBranch(b);
                      setBranchOpen(false);
                    }}
                    className={[
                      "flex w-full items-center px-3 py-1.5 text-left text-sm hover:bg-[var(--dh-surface-hover)]",
                      b === meta.branch
                        ? "text-blue-700 dark:text-blue-400"
                        : "text-[var(--dh-text)]",
                    ].join(" ")}
                  >
                    {b}
                  </button>
                ))}
              </div>
            )}
          </div>

          <a
            href={meta.htmlUrl}
            target="_blank"
            rel="noreferrer"
            title="Open on GitHub"
            className="flex h-8 items-center gap-1.5 rounded-md border border-[var(--dh-window-border)] bg-[var(--dh-surface)] px-2.5 text-sm text-[var(--dh-text)] hover:border-[var(--dh-window-border-active)]"
          >
            <ExternalLink width={14} height={14} />
            GitHub
          </a>

          <button
            onClick={() => setUploadOpen(true)}
            title="Upload files"
            className="flex h-8 items-center gap-1.5 rounded-md border border-[var(--dh-window-border)] bg-[var(--dh-surface)] px-2.5 text-sm text-[var(--dh-text)] hover:border-blue-600 hover:text-blue-700 dark:text-blue-300"
          >
            <Upload width={14} height={14} />
            Upload
          </button>

          <button
            onClick={onCloseRepo ?? closeRepo}
            title="Close repository"
            className="flex h-8 items-center justify-center rounded-md px-2 text-[var(--dh-text-secondary)] hover:bg-[var(--dh-surface-hover)] hover:text-[var(--dh-text)]"
          >
            <X width={16} height={16} />
          </button>
        </>
      )}

      {meta && (
        <div className="hidden items-center gap-3 border-l border-[var(--dh-window-border)] pl-3 text-xs text-[var(--dh-text-secondary)] lg:flex">
          {meta.language && (
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-400" />
              {meta.language}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Star width={13} height={13} className="text-amber-700 dark:text-amber-400" />
            {meta.stars.toLocaleString()}
          </span>
          <span className="max-w-[180px] truncate" title={meta.description ?? ""}>
            {meta.description}
          </span>
        </div>
      )}

      <UploadPanel open={uploadOpen} onClose={() => setUploadOpen(false)} />
    </div>
  );
}
