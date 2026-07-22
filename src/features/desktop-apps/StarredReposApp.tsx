"use client";

import { useEffect, useMemo, useState } from "react";
import { useWindowManager } from "@/features/desktop/WindowManagerProvider";
import { parseRepoInput } from "@/lib/github";
import {
  listStarredRepos,
  starRepo,
  unstarRepo,
  type StarredRepo,
} from "@/features/starred/api";
import {
  ArrowClockwiseRegular as Refresh,
  GithubMark,
  OpenRegular as ExternalLink,
  SearchRegular as Search,
  Spinner,
  StarFilled,
} from "@/features/icons";

/**
 * Starred repo manager (issue #33): view, open, add and remove the
 * authenticated user's GitHub stars from inside DRAGHUB, instead of
 * bouncing out to github.com/{user}?tab=stars.
 *
 * Deliberately separate from the Dock's "pinned" concept — a star is a
 * real, server-side GitHub relationship shared across every GitHub client
 * the user has; a Dock pin is a local DRAGHUB launcher shortcut. Starring a
 * repo here does not pin it, and pinning a repo does not star it.
 */
export function StarredReposApp() {
  const wm = useWindowManager();
  const [repos, setRepos] = useState<StarredRepo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [addInput, setAddInput] = useState("");
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [busyRepo, setBusyRepo] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    listStarredRepos()
      .then(setRepos)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load."))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const filtered = useMemo(() => {
    if (!repos) return [];
    const q = query.trim().toLowerCase();
    if (!q) return repos;
    return repos.filter(
      (r) =>
        r.fullName.toLowerCase().includes(q) ||
        (r.description ?? "").toLowerCase().includes(q) ||
        (r.language ?? "").toLowerCase().includes(q)
    );
  }, [repos, query]);

  const openRepo = (fullName: string) =>
    wm.openOrFocusWindow({
      applicationId: "repository-explorer",
      owner: { type: "desktop" },
      resource: { type: "repository", repoKey: fullName },
      title: fullName,
    });

  const handleUnstar = (repo: StarredRepo) => {
    setBusyRepo(repo.fullName);
    unstarRepo(repo.owner, repo.repo)
      .then(() => setRepos((prev) => prev?.filter((r) => r.fullName !== repo.fullName) ?? null))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to unstar."))
      .finally(() => setBusyRepo(null));
  };

  const handleAdd = async () => {
    const parsed = parseRepoInput(addInput);
    if (!parsed) {
      setAddError("Use owner/repo or a github.com URL.");
      return;
    }
    setAddBusy(true);
    setAddError(null);
    try {
      await starRepo(parsed.owner, parsed.repo);
      setAddInput("");
      load();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to star.");
    } finally {
      setAddBusy(false);
    }
  };

  return (
    <div className="flex h-full flex-col bg-[var(--dh-surface)] text-[var(--dh-text)]">
      <div className="flex items-center gap-2 border-b border-[var(--dh-window-border)] px-3 py-2">
        <StarFilled width={15} height={15} className="text-amber-500" />
        <span className="text-sm font-medium">Starred Repositories</span>
        <span className="text-xs text-[var(--dh-text-secondary)]">
          {repos ? `${repos.length}` : "…"}
        </span>
        <button
          onClick={load}
          disabled={loading}
          title="Refresh"
          className="ml-auto flex h-6 w-6 items-center justify-center rounded text-[var(--dh-text-secondary)] hover:bg-[var(--dh-surface-hover)] disabled:opacity-40"
        >
          {loading ? (
            <Spinner width={13} height={13} className="text-blue-700 dark:text-blue-400" />
          ) : (
            <Refresh width={13} height={13} />
          )}
        </button>
      </div>

      <div className="flex items-center gap-2 border-b border-[var(--dh-window-border)] px-3 py-2">
        <input
          value={addInput}
          onChange={(e) => setAddInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleAdd();
          }}
          placeholder="owner/repo — star a repository"
          className="flex-1 rounded border border-[var(--dh-window-border)] bg-[var(--dh-surface)] px-2 py-1 text-sm outline-none placeholder:text-[var(--dh-text-disabled)] focus:border-[var(--dh-window-border-active)]"
        />
        <button
          onClick={() => void handleAdd()}
          disabled={addBusy || !addInput.trim()}
          className="flex shrink-0 items-center gap-1 rounded bg-[var(--dh-accent)] px-2.5 py-1 text-xs font-medium text-[var(--dh-accent-foreground)] hover:opacity-90 disabled:opacity-40"
        >
          <StarFilled width={12} height={12} />
          Star
        </button>
      </div>
      {addError && (
        <p className="border-b border-[var(--dh-window-border)] px-3 py-1 text-xs text-red-600 dark:text-red-300">
          {addError}
        </p>
      )}

      {repos && repos.length > 0 && (
        <div className="flex items-center gap-2 border-b border-[var(--dh-window-border)] px-3 py-1.5">
          <Search width={13} height={13} className="text-[var(--dh-text-secondary)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter starred repositories…"
            className="flex-1 bg-transparent text-xs outline-none placeholder:text-[var(--dh-text-disabled)]"
          />
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {error && (
          <div className="m-3 rounded border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 px-3 py-2 text-sm text-red-600 dark:text-red-300">
            {error}
          </div>
        )}
        {!error && loading && !repos && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-[var(--dh-text-secondary)]">
            <Spinner width={18} height={18} className="text-blue-700 dark:text-blue-400" />
            Loading starred repositories…
          </div>
        )}
        {!error && repos && repos.length === 0 && (
          <p className="p-4 text-sm text-[var(--dh-text-secondary)]">
            No starred repositories yet — star one above.
          </p>
        )}
        {!error && repos && repos.length > 0 && filtered.length === 0 && (
          <p className="p-4 text-sm text-[var(--dh-text-secondary)]">
            No starred repositories match &quot;{query}&quot;.
          </p>
        )}
        {filtered.length > 0 && (
          <ul>
            {filtered.map((r) => (
              <li
                key={r.fullName}
                className="flex items-start gap-2 border-b border-[var(--dh-window-border)]/60 px-3 py-2 last:border-0"
              >
                <GithubMark width={14} height={14} className="mt-0.5 shrink-0 text-[var(--dh-text-secondary)]" />
                <div className="min-w-0 flex-1">
                  <button
                    onClick={() => openRepo(r.fullName)}
                    className="truncate text-left text-sm font-medium text-[var(--dh-text)] hover:underline"
                  >
                    {r.fullName}
                  </button>
                  {r.description && (
                    <p className="truncate text-xs text-[var(--dh-text-secondary)]">
                      {r.description}
                    </p>
                  )}
                  <p className="text-[11px] text-[var(--dh-text-disabled)]">
                    {r.language ? `${r.language} · ` : ""}
                    {r.stars.toLocaleString()} stars
                  </p>
                </div>
                <a
                  href={r.htmlUrl}
                  target="_blank"
                  rel="noreferrer"
                  title="Open on GitHub"
                  className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded text-[var(--dh-text-secondary)] hover:bg-[var(--dh-surface-hover)]"
                >
                  <ExternalLink width={13} height={13} />
                </a>
                <button
                  onClick={() => handleUnstar(r)}
                  disabled={busyRepo === r.fullName}
                  title="Unstar"
                  className="mt-0.5 flex shrink-0 items-center gap-1 rounded border border-[var(--dh-window-border)] px-2 py-1 text-xs text-[var(--dh-text-secondary)] hover:border-red-300 hover:text-red-600 disabled:opacity-40 dark:hover:border-red-800 dark:hover:text-red-400"
                >
                  <StarFilled width={12} height={12} className="text-amber-500" />
                  Unstar
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
