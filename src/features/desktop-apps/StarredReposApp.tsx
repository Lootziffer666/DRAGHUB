"use client";

import { useEffect, useMemo, useState } from "react";
import { useWindowManager } from "@/features/desktop/WindowManagerProvider";
import { parseRepoInput } from "@/lib/github";
import { isAiConfigured } from "@/lib/ai";
import {
  listStarredRepos,
  starRepo,
  unstarRepo,
  type StarredRepo,
} from "@/features/starred/api";
import { categorizeRepos, loadCategories } from "@/features/starred/categorize";
import { semanticRank, type RankedRepo } from "@/features/starred/semantic-search";
import {
  ArrowClockwiseRegular as Refresh,
  DismissCircleFilled as ClearX,
  GithubMark,
  OpenRegular as ExternalLink,
  SearchRegular as Search,
  SearchSparkleRegular as SmartSearchIcon,
  SparkleRegular as Sparkle,
  Spinner,
  StarFilled,
  TagMultipleRegular as TagIcon,
} from "@/features/icons";

const UNCATEGORIZED = "__uncategorized__";
// A loose floor, not a precision cutoff — just enough to drop results the
// embedding model considers essentially unrelated to the query, while
// staying permissive since "semantic" matches are rarely near 1.0.
const SMART_SEARCH_MIN_SCORE = 0.15;

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

  const [aiAvailable, setAiAvailable] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const [categories, setCategories] = useState<Record<string, string>>({});
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [categorizing, setCategorizing] = useState(false);
  const [categorizeProgress, setCategorizeProgress] = useState<{ done: number; total: number } | null>(null);

  const [smartQuery, setSmartQuery] = useState("");
  const [smartResults, setSmartResults] = useState<RankedRepo[] | null>(null);
  const [smartBusy, setSmartBusy] = useState(false);
  const [smartProgress, setSmartProgress] = useState<{ done: number; total: number } | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    listStarredRepos()
      .then(setRepos)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load."))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);
  useEffect(() => setAiAvailable(isAiConfigured()), []);
  useEffect(() => {
    if (repos) setCategories(loadCategories(repos));
  }, [repos]);

  const categoryList = useMemo(
    () => [...new Set(Object.values(categories))].sort((a, b) => a.localeCompare(b)),
    [categories]
  );
  const uncategorizedCount = repos
    ? repos.filter((r) => !categories[r.fullName]).length
    : 0;

  const runCategorize = async (force = false) => {
    if (!repos) return;
    if (!isAiConfigured()) {
      setAiError("No AI provider configured — add one in Settings.");
      return;
    }
    setAiError(null);
    setCategorizing(true);
    setCategorizeProgress({ done: 0, total: repos.length });
    try {
      const result = await categorizeRepos(repos, {
        force,
        onProgress: (done, total) => setCategorizeProgress({ done, total }),
      });
      setCategories(result);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Categorization failed.");
    } finally {
      setCategorizing(false);
      setCategorizeProgress(null);
    }
  };

  const runSmartSearch = async () => {
    if (!repos || !smartQuery.trim()) return;
    if (!isAiConfigured()) {
      setAiError("No AI provider configured — add one in Settings.");
      return;
    }
    setAiError(null);
    setSmartBusy(true);
    setSmartProgress({ done: 0, total: repos.length });
    try {
      const ranked = await semanticRank(repos, smartQuery.trim(), (done, total) =>
        setSmartProgress({ done, total })
      );
      setSmartResults(ranked.filter((r) => r.score >= SMART_SEARCH_MIN_SCORE));
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Smart search failed.");
    } finally {
      setSmartBusy(false);
      setSmartProgress(null);
    }
  };

  const clearSmartSearch = () => {
    setSmartResults(null);
    setSmartQuery("");
  };

  const filtered = useMemo(() => {
    if (!repos) return [];
    const q = query.trim().toLowerCase();
    const textMatched = !q
      ? repos
      : repos.filter(
          (r) =>
            r.fullName.toLowerCase().includes(q) ||
            (r.description ?? "").toLowerCase().includes(q) ||
            (r.language ?? "").toLowerCase().includes(q)
        );
    if (!activeCategory) return textMatched;
    return textMatched.filter((r) =>
      activeCategory === UNCATEGORIZED
        ? !categories[r.fullName]
        : categories[r.fullName] === activeCategory
    );
  }, [repos, query, activeCategory, categories]);

  // Smart Search results, when active, take over the list entirely — it's
  // a separate mode (ranked by relevance) rather than another filter
  // layered on top of the plain substring/category filters.
  const displayed = smartResults ? smartResults.map((r) => r.repo) : filtered;

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

      {repos && repos.length > 0 && (
        <div className="flex items-center gap-2 border-b border-[var(--dh-window-border)] px-3 py-1.5">
          <SmartSearchIcon width={13} height={13} className="shrink-0 text-[var(--dh-text-secondary)]" />
          <input
            value={smartQuery}
            onChange={(e) => setSmartQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void runSmartSearch();
            }}
            placeholder={
              aiAvailable
                ? "Smart search — describe what you're looking for…"
                : "Smart search needs an AI provider — add one in Settings"
            }
            disabled={!aiAvailable}
            className="flex-1 bg-transparent text-xs outline-none placeholder:text-[var(--dh-text-disabled)] disabled:cursor-not-allowed"
          />
          {smartResults ? (
            <button
              onClick={clearSmartSearch}
              title="Clear smart search"
              className="flex shrink-0 items-center gap-1 rounded px-2 py-0.5 text-xs text-[var(--dh-text-secondary)] hover:bg-[var(--dh-surface-hover)]"
            >
              <ClearX width={13} height={13} />
              {smartResults.length} result{smartResults.length === 1 ? "" : "s"}
            </button>
          ) : (
            <button
              onClick={() => void runSmartSearch()}
              disabled={!aiAvailable || smartBusy || !smartQuery.trim()}
              className="flex shrink-0 items-center gap-1 rounded bg-[var(--dh-accent)] px-2.5 py-1 text-xs font-medium text-[var(--dh-accent-foreground)] hover:opacity-90 disabled:opacity-40"
            >
              {smartBusy ? (
                <Spinner width={12} height={12} />
              ) : (
                <SmartSearchIcon width={12} height={12} />
              )}
              Search
            </button>
          )}
        </div>
      )}
      {smartBusy && smartProgress && smartProgress.total > 0 && (
        <p className="border-b border-[var(--dh-window-border)] px-3 py-1 text-[11px] text-[var(--dh-text-secondary)]">
          Embedding {smartProgress.done} of {smartProgress.total} starred repositories…
        </p>
      )}

      {repos && repos.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-[var(--dh-window-border)] px-3 py-1.5">
          <TagIcon width={13} height={13} className="shrink-0 text-[var(--dh-text-secondary)]" />
          <CategoryChip label="All" active={!activeCategory} onClick={() => setActiveCategory(null)} />
          {categoryList.map((c) => (
            <CategoryChip
              key={c}
              label={c}
              active={activeCategory === c}
              onClick={() => setActiveCategory(c)}
            />
          ))}
          {uncategorizedCount > 0 && (
            <CategoryChip
              label={`Uncategorized (${uncategorizedCount})`}
              active={activeCategory === UNCATEGORIZED}
              onClick={() => setActiveCategory(UNCATEGORIZED)}
            />
          )}
          <button
            onClick={() => void runCategorize(false)}
            disabled={!aiAvailable || categorizing || uncategorizedCount === 0}
            title={
              aiAvailable
                ? "Assign an AI category to every uncategorized repo"
                : "Add an AI provider in Settings to categorize"
            }
            className="ml-auto flex shrink-0 items-center gap-1 rounded border border-[var(--dh-window-border)] px-2 py-0.5 text-[11px] text-[var(--dh-text-secondary)] hover:border-[var(--dh-window-border-active)] disabled:opacity-40"
          >
            {categorizing ? <Spinner width={11} height={11} /> : <Sparkle width={11} height={11} />}
            {categorizing && categorizeProgress
              ? `Categorizing ${categorizeProgress.done}/${categorizeProgress.total}…`
              : "Categorize with AI"}
          </button>
          {categoryList.length > 0 && (
            <button
              onClick={() => void runCategorize(true)}
              disabled={!aiAvailable || categorizing}
              title="Recompute categories for every starred repo, ignoring the cache"
              className="shrink-0 text-[11px] text-[var(--dh-text-secondary)] hover:underline disabled:opacity-40"
            >
              Recategorize all
            </button>
          )}
        </div>
      )}
      {aiError && (
        <p className="border-b border-[var(--dh-window-border)] px-3 py-1 text-xs text-red-600 dark:text-red-300">
          {aiError}
        </p>
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
        {!error && repos && repos.length > 0 && displayed.length === 0 && (
          <p className="p-4 text-sm text-[var(--dh-text-secondary)]">
            {smartResults
              ? `No starred repositories matched "${smartQuery}" closely enough.`
              : `No starred repositories match "${query}".`}
          </p>
        )}
        {displayed.length > 0 && (
          <ul>
            {displayed.map((r) => (
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
                  <p className="flex items-center gap-1.5 text-[11px] text-[var(--dh-text-disabled)]">
                    <span>
                      {r.language ? `${r.language} · ` : ""}
                      {r.stars.toLocaleString()} stars
                    </span>
                    {categories[r.fullName] && (
                      <span className="rounded-full bg-[var(--dh-surface-hover)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--dh-text-secondary)]">
                        {categories[r.fullName]}
                      </span>
                    )}
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

function CategoryChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "rounded-full border px-2 py-0.5 text-[11px]",
        active
          ? "border-[var(--dh-accent)] bg-[var(--dh-accent)] text-[var(--dh-accent-foreground)]"
          : "border-[var(--dh-window-border)] text-[var(--dh-text-secondary)] hover:border-[var(--dh-window-border-active)]",
      ].join(" ")}
    >
      {label}
    </button>
  );
}
