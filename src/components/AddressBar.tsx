"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
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

export function AddressBar({ onGoHome }: { onGoHome: () => void }) {
  const { state, openRepo, setBranch, closeRepo } = useStore();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [value, setValue] = useState("");
  const [branches, setBranches] = useState<string[]>([]);
  const [branchOpen, setBranchOpen] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [showRecent, setShowRecent] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const meta = state.meta;

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
  }, [state.repoLoading]);

  function submit() {
    if (!value.trim()) return;
    void openRepo(value);
    setShowRecent(false);
    inputRef.current?.blur();
  }

  return (
    <div className="flex items-center gap-2 border-b border-neutral-800 bg-neutral-900 px-3 py-2">
      <button
        onClick={onGoHome}
        title="Home"
        className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
      >
        <Home width={18} height={18} />
      </button>

      <div className="relative flex-1">
        <div className="flex items-center gap-2 rounded-md border border-neutral-700 bg-neutral-950 px-3 py-1.5 focus-within:border-blue-600">
          <Search width={15} height={15} className="text-neutral-500" />
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
            className="flex-1 bg-transparent text-sm text-neutral-100 outline-none placeholder:text-neutral-600"
            spellCheck={false}
          />
          {state.repoLoading && (
            <Spinner width={15} height={15} className="text-blue-400" />
          )}
          {value && (
            <button
              onClick={() => setValue("")}
              className="text-neutral-500 hover:text-neutral-200"
            >
              <X width={14} height={14} />
            </button>
          )}
        </div>
        {showRecent && recent.length > 0 && !meta && (
          <div className="absolute z-40 mt-1 w-full overflow-hidden rounded-md border border-neutral-700 bg-neutral-900 shadow-xl">
            {recent.map((r) => (
              <button
                key={r}
                onMouseDown={(e) => {
                  e.preventDefault();
                  setValue(r);
                  void openRepo(r);
                  setShowRecent(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-neutral-200 hover:bg-neutral-800"
              >
                <GitBranch width={14} height={14} className="text-neutral-500" />
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
              className="flex items-center gap-1.5 rounded-md border border-neutral-700 bg-neutral-950 px-2.5 py-1.5 text-sm text-neutral-200 hover:border-neutral-600"
            >
              <GitBranch width={14} height={14} className="text-blue-400" />
              <span className="max-w-[140px] truncate">{meta.branch}</span>
              <ChevronDown width={14} height={14} className="text-neutral-500" />
            </button>
            {branchOpen && (
              <div className="absolute right-0 z-40 mt-1 max-h-72 w-56 overflow-auto rounded-md border border-neutral-700 bg-neutral-900 py-1 shadow-xl">
                {branches.map((b) => (
                  <button
                    key={b}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setBranch(b);
                      setBranchOpen(false);
                    }}
                    className={[
                      "flex w-full items-center px-3 py-1.5 text-left text-sm hover:bg-neutral-800",
                      b === meta.branch
                        ? "text-blue-400"
                        : "text-neutral-200",
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
            className="flex h-8 items-center gap-1.5 rounded-md border border-neutral-700 bg-neutral-950 px-2.5 text-sm text-neutral-200 hover:border-neutral-600"
          >
            <ExternalLink width={14} height={14} />
            GitHub
          </a>

          <button
            onClick={() => setUploadOpen(true)}
            title="Upload files"
            className="flex h-8 items-center gap-1.5 rounded-md border border-neutral-700 bg-neutral-950 px-2.5 text-sm text-neutral-200 hover:border-blue-600 hover:text-blue-300"
          >
            <Upload width={14} height={14} />
            Upload
          </button>

          <button
            onClick={closeRepo}
            title="Close repository"
            className="flex h-8 items-center justify-center rounded-md px-2 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
          >
            <X width={16} height={16} />
          </button>
        </>
      )}

      {meta && (
        <div className="hidden items-center gap-3 border-l border-neutral-800 pl-3 text-xs text-neutral-400 lg:flex">
          {meta.language && (
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-400" />
              {meta.language}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Star width={13} height={13} className="text-amber-400" />
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
