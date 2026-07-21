"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useStore } from "@/lib/store";
import { formatBytes, ghRequest } from "@/lib/github";
import { useWindowManager } from "@/features/desktop/WindowManagerProvider";
import { changesFor, repoKeysWithChanges, subscribeChanges } from "@/features/changes/store";
import {
  appIconFor,
  ArrowSyncRegular as ChangesIcon,
  ClockRegular,
  DraghubMark,
  OpenRegular as ExternalLink,
  DocumentRegular as FileIcon,
  BranchForkRegular as GitBranch,
  GithubMark,
  PlugConnectedRegular,
  SearchRegular as Search,
  Spinner,
  StarRegular as Star,
  DismissRegular as X,
} from "@/features/icons";
import {
  searchRepositories,
  searchRelatedRepos,
  searchReposWithReleases,
  type RepoWithReleases,
  type SearchRepo,
} from "./github-search";

type Mode = "repos" | "related" | "releases";

type RateLimitInfo = { remaining: string | null; reset: string | null };

/** Live GitHub API rate-limit status for the launcher's status card — the
 * same /rate_limit endpoint the Dock polls, fetched independently here so
 * this panel doesn't depend on the Dock being mounted. */
function useGithubRateLimit(): RateLimitInfo {
  const [rate, setRate] = useState<RateLimitInfo>({ remaining: null, reset: null });
  useEffect(() => {
    let cancelled = false;
    async function poll() {
      if (document.hidden) return;
      try {
        const res = await ghRequest("/rate_limit");
        if (cancelled || !res.ok) return;
        const data = await res.json<{
          resources?: { core?: { remaining: number; reset: number } };
        }>();
        const core = data.resources?.core;
        if (core) {
          setRate({
            remaining: String(core.remaining),
            reset: new Date(core.reset * 1000).toLocaleTimeString(),
          });
        }
      } catch {
        // Rate-limit status is a nice-to-have; a failed poll just leaves
        // the previous (or "Checking…") value in place.
      }
    }
    void poll();
    const id = window.setInterval(poll, 120_000);
    const onVisible = () => void poll();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return rate;
}

type Identity = { login: string; avatarUrl: string } | null;

/** The authenticated GitHub identity behind the configured token, fetched
 * once per launcher session — real account data for the launcher's greeting,
 * not a placeholder name. Resolves to null (rendered as "not signed in")
 * when no token is configured or the request fails. */
function useGithubIdentity(): { identity: Identity; loading: boolean } {
  const [identity, setIdentity] = useState<Identity>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    ghRequest("/user")
      .then(async (res) => {
        if (!res.ok || cancelled) return;
        const data = await res.json<{ login: string; avatar_url: string }>();
        if (!cancelled) setIdentity({ login: data.login, avatarUrl: data.avatar_url });
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);
  return { identity, loading };
}

/** The launcher's "home" content: a greeting, a quick-access row (recently
 * opened repositories, live GitHub rate-limit status), an adaptive widget
 * surfacing repositories with unsaved working changes, and a grid of
 * DRAGHUB's own standalone tools — everything here is real data/real
 * windows, the same `state.recent`/`openOrFocusWindow` the rest of the
 * desktop uses, not placeholder content. */
function HomeView({
  onSelectRepo,
}: {
  onSelectRepo: (fullName: string) => void;
}) {
  const { state } = useStore();
  const wm = useWindowManager();
  const rate = useGithubRateLimit();
  const { identity, loading: identityLoading } = useGithubIdentity();
  const recent = state.recent.slice(0, 5);
  const repoKeysPending = useSyncExternalStore(
    subscribeChanges,
    () => repoKeysWithChanges(),
    () => []
  );

  const tools: { id: string; label: string; iconKey: string; open: () => void }[] = [
    {
      id: "scratchpad",
      label: "Scratchpad",
      iconKey: "code",
      open: () =>
        wm.openOrFocusWindow({
          applicationId: "tool-window",
          owner: { type: "desktop" },
          resource: { type: "tool", toolId: "scratchpad" },
          title: "Scratchpad",
        }),
    },
    {
      id: "settings",
      label: "Settings",
      iconKey: "settings",
      open: () =>
        wm.openOrFocusWindow({
          applicationId: "settings",
          owner: { type: "desktop" },
          resource: { type: "system", systemId: "settings" },
          title: "Settings",
        }),
    },
    {
      id: "recycle-bin",
      label: "Recycle Bin",
      iconKey: "recycle-bin",
      open: () =>
        wm.openOrFocusWindow({
          applicationId: "recycle-bin",
          owner: { type: "desktop" },
          resource: { type: "system", systemId: "recycle-bin" },
          title: "Recycle Bin",
        }),
    },
  ];

  return (
    <div className="flex flex-col gap-4 p-3">
      <div className="flex items-center gap-2.5 px-1">
        {identity ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={identity.avatarUrl} alt="" width={32} height={32} className="rounded-full" />
            <span className="text-sm font-medium text-[var(--dh-text)]">
              Welcome back, {identity.login}
            </span>
          </>
        ) : identityLoading ? (
          <span className="text-sm text-[var(--dh-text-secondary)]">Checking sign-in…</span>
        ) : (
          <span className="text-sm text-[var(--dh-text-secondary)]">
            Not signed in — add a token in Settings to unlock writes and a higher rate limit.
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-[var(--dh-window-border)] bg-[var(--dh-surface)] p-3">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-[var(--dh-text-secondary)]">
            <ClockRegular width={13} height={13} />
            Recent
          </div>
          {recent.length === 0 ? (
            <p className="text-xs text-[var(--dh-text-disabled)]">
              No repositories opened yet.
            </p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {recent.map((key) => (
                <li key={key}>
                  <button
                    onClick={() => onSelectRepo(key)}
                    className="flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-[13px] text-[var(--dh-text)] hover:bg-[var(--dh-surface-hover)]"
                  >
                    <GithubMark
                      width={12}
                      height={12}
                      className="shrink-0 text-[var(--dh-text-secondary)]"
                    />
                    <span className="truncate">{key}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-lg border border-[var(--dh-window-border)] bg-[var(--dh-surface)] p-3">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-[var(--dh-text-secondary)]">
            <PlugConnectedRegular width={13} height={13} />
            GitHub status
          </div>
          {rate.remaining === null ? (
            <p className="text-xs text-[var(--dh-text-disabled)]">Checking…</p>
          ) : (
            <p className="text-[13px] text-[var(--dh-text)]">
              {rate.remaining} requests left
              {rate.reset && (
                <span className="block text-xs text-[var(--dh-text-secondary)]">
                  Resets {rate.reset}
                </span>
              )}
            </p>
          )}
        </div>
      </div>

      {/* Adaptive: only appears when there's something to act on — the
          "widgets generated according to usage" idea, using real local
          Working Changes state instead of a fixed slot. */}
      {repoKeysPending.length > 0 && (
        <div className="rounded-lg border border-[var(--dh-window-border)] bg-[var(--dh-surface)] p-3">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-[var(--dh-text-secondary)]">
            <ChangesIcon width={13} height={13} />
            Unsaved working changes
          </div>
          <ul className="flex flex-col gap-0.5">
            {repoKeysPending.map((key) => (
              <li key={key}>
                <button
                  onClick={() => onSelectRepo(key)}
                  className="flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-[13px] text-[var(--dh-text)] hover:bg-[var(--dh-surface-hover)]"
                >
                  <GithubMark width={12} height={12} className="shrink-0 text-[var(--dh-text-secondary)]" />
                  <span className="min-w-0 flex-1 truncate">{key}</span>
                  <span className="shrink-0 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
                    {changesFor(key).length}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <div className="mb-2 text-xs font-medium text-[var(--dh-text-secondary)]">
          Tools
        </div>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {tools.map((tool) => {
            const Icon = appIconFor(tool.iconKey);
            return (
              <button
                key={tool.id}
                onClick={tool.open}
                className="flex flex-col items-center gap-1.5 rounded-lg p-2 text-center hover:bg-[var(--dh-surface-hover)]"
              >
                <span className="grid h-10 w-10 place-items-center rounded-lg border border-[var(--dh-window-border)] bg-[color-mix(in_srgb,var(--dh-surface-raised)_60%,transparent)] text-[var(--dh-accent)]">
                  <Icon width={18} height={18} />
                </span>
                <span className="text-[11px] text-[var(--dh-text-secondary)]">
                  {tool.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function SearchPanel({
  onClose,
  onSelectRepo,
  relatedRepoKey,
}: {
  onClose: () => void;
  onSelectRepo?: (fullName: string) => void;
  relatedRepoKey: string | null;
}) {
  const { state, openRepo } = useStore();
  const [mode, setMode] = useState<Mode>("repos");
  const [query, setQuery] = useState("");
  const [repos, setRepos] = useState<SearchRepo[]>([]);
  const [related, setRelated] = useState<SearchRepo[]>([]);
  const [releases, setReleases] = useState<RepoWithReleases[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const relatedMeta =
    relatedRepoKey && relatedRepoKey.includes("/")
      ? (() => {
          const idx = relatedRepoKey.indexOf("/");
          return {
            owner: relatedRepoKey.slice(0, idx),
            repo: relatedRepoKey.slice(idx + 1),
          };
        })()
      : null;

  // Debounced text search for repos / releases modes
  useEffect(() => {
    if (mode === "related") return;
    const handle = setTimeout(() => {
      void runTextSearch();
    }, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, mode]);

  async function runTextSearch() {
    if (!query.trim()) {
      setRepos([]);
      setReleases([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (mode === "releases") {
        setReleases(await searchReposWithReleases(query, 12));
      } else {
        setRepos(
          await searchRepositories(query, {
            sort: "stars",
            order: "desc",
            perPage: 20,
          })
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed.");
    } finally {
      setLoading(false);
    }
  }

  async function runRelated() {
    if (!relatedMeta) return;
    setLoading(true);
    setError(null);
    setRelated([]);
    try {
      setRelated(await searchRelatedRepos(relatedMeta.owner, relatedMeta.repo, 20));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed.");
    } finally {
      setLoading(false);
    }
  }

  // Auto-run related when switching into that mode with a focused-window repo
  useEffect(() => {
    if (mode === "related" && relatedMeta) void runRelated();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const modes: { id: Mode; label: string }[] = [
    { id: "repos", label: "Repositories" },
    { id: "related", label: "Related" },
    { id: "releases", label: "Releases & APKs" },
  ];

  function selectRepo(fullName: string) {
    if (onSelectRepo) onSelectRepo(fullName);
    else void openRepo(fullName);
    onClose();
  }

  // The launcher's "home" state — greeting, quick-access cards and the
  // tool grid — shows only for the default Repositories tab with nothing
  // typed yet, the same way a Start Menu's widgets/grid give way to search
  // results the moment you start typing.
  const isHome = mode === "repos" && !query.trim();

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center bg-black/30 p-4 pt-[8vh] backdrop-blur-sm">
      <div className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-[var(--dh-window-border)] bg-[color-mix(in_srgb,var(--dh-surface-raised)_72%,transparent)] shadow-2xl backdrop-blur-2xl backdrop-saturate-150">
        <div className="flex items-center gap-2 px-4 pb-1 pt-3">
          <DraghubMark className="h-4 w-4 text-[var(--dh-lime-brand)]" />
          <h2 className="text-sm font-semibold text-[var(--dh-text)]">Kapitänskajüte</h2>
        </div>
        <div className="flex items-center gap-2 border-b border-[var(--dh-window-border)] px-3 py-2.5">
          <Search width={18} height={18} className="text-[var(--dh-text-secondary)]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
            }}
            placeholder={
              mode === "releases"
                ? "Find repos with releases & APK downloads…"
                : mode === "related"
                  ? "Related to the open repository…"
                  : "Chart a course — search repositories…"
            }
            className="flex-1 bg-transparent text-sm text-[var(--dh-text)] outline-none placeholder:text-[var(--dh-text-disabled)]"
            spellCheck={false}
          />
          {loading && <Spinner width={16} height={16} className="text-blue-700 dark:text-blue-400" />}
          <button
            onClick={onClose}
            aria-label="Close launcher"
            className="flex h-7 w-7 items-center justify-center rounded text-[var(--dh-text-secondary)] hover:bg-[var(--dh-surface-hover)] hover:text-[var(--dh-text)]"
          >
            <X width={16} height={16} />
          </button>
        </div>

        <div className="flex items-center gap-1 border-b border-[var(--dh-window-border)] px-2 py-1.5">
          {modes.map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={[
                "rounded-md px-3 py-1 text-[13px] transition-colors",
                mode === m.id
                  ? "bg-[var(--dh-surface-selected)] text-[var(--dh-text)]"
                  : "text-[var(--dh-text-secondary)] hover:bg-[var(--dh-surface-hover)] hover:text-[var(--dh-text)]",
              ].join(" ")}
            >
              {m.label}
            </button>
          ))}
          {mode === "related" && relatedMeta && (
            <button
              onClick={() => void runRelated()}
              className="ml-auto rounded-md px-2.5 py-1 text-[13px] text-blue-700 dark:text-blue-400 hover:bg-[var(--dh-surface-hover)]"
            >
              Refresh
            </button>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-2">
          {error && (
            <div className="m-2 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 px-3 py-2 text-sm text-red-600 dark:text-red-300">
              {error}
            </div>
          )}

          {mode === "related" && !relatedMeta && (
            <div className="p-8 text-center text-sm text-[var(--dh-text-secondary)]">
              Focus a repository, file, or GitHub-feature window to use Related.
            </div>
          )}

          {isHome && <HomeView onSelectRepo={selectRepo} />}

          {mode === "repos" && !isHome && (
            <RepoList repos={repos} onSelect={selectRepo} />
          )}

          {mode === "related" && (
            <RepoList repos={related} onSelect={selectRepo} />
          )}

          {mode === "releases" && (
            <ReleaseList releases={releases} onSelectRepo={selectRepo} />
          )}
        </div>
      </div>
    </div>
  );
}

function RepoList({
  repos,
  onSelect,
}: {
  repos: SearchRepo[];
  onSelect: (fullName: string) => void;
}) {
  if (repos.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      {repos.map((r) => (
        <button
          key={r.id}
          onClick={() => onSelect(r.fullName)}
          className="group flex flex-col gap-1 rounded-lg border border-transparent px-3 py-2 text-left hover:border-[var(--dh-window-border)] hover:bg-[var(--dh-surface-hover)]/60"
        >
          <div className="flex items-center gap-2">
            <GithubMark width={15} height={15} className="shrink-0 text-[var(--dh-text-secondary)]" />
            <span className="truncate font-medium text-[var(--dh-text)]">
              {r.fullName}
            </span>
            <span className="ml-auto flex shrink-0 items-center gap-3 text-[12px] text-[var(--dh-text-secondary)]">
              {r.language && (
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-blue-400" />
                  {r.language}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Star width={12} height={12} className="text-amber-700 dark:text-amber-400" />
                {r.stars.toLocaleString()}
              </span>
            </span>
          </div>
          {r.description && (
            <p className="line-clamp-2 text-[13px] text-[var(--dh-text-secondary)]">
              {r.description}
            </p>
          )}
          {r.topics.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {r.topics.slice(0, 5).map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-[var(--dh-surface-hover)] px-2 py-0.5 text-[11px] text-[var(--dh-text-secondary)]"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </button>
      ))}
    </div>
  );
}

function ReleaseList({
  releases,
  onSelectRepo,
}: {
  releases: RepoWithReleases[];
  onSelectRepo: (fullName: string) => void;
}) {
  if (releases.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      {releases.map(({ repo, releases: rels, hasApk }) => (
        <div
          key={repo.id}
          className="rounded-lg border border-[var(--dh-window-border)] bg-[var(--dh-surface)]/60 p-3"
        >
          <div className="flex items-center gap-2">
            <button
              onClick={() => onSelectRepo(repo.fullName)}
              className="truncate font-medium text-[var(--dh-text)] hover:text-blue-700 dark:hover:text-blue-400"
            >
              {repo.fullName}
            </button>
            {hasApk && (
              <span className="rounded bg-green-600/20 px-1.5 py-0.5 text-[11px] font-medium text-green-700 dark:text-green-400">
                APK
              </span>
            )}
            <a
              href={repo.htmlUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="ml-auto text-[var(--dh-text-secondary)] hover:text-[var(--dh-text)]"
              title="Open on GitHub"
            >
              <ExternalLink width={14} height={14} />
            </a>
          </div>
          <div className="mt-2 flex flex-col gap-2">
            {rels.map((rel) => (
              <div key={rel.tag} className="rounded-md bg-[var(--dh-surface-raised)]/80 p-2">
                <div className="flex items-center gap-2 text-[13px]">
                  <GitBranch width={13} height={13} className="text-blue-700 dark:text-blue-400" />
                  <span className="font-medium text-[var(--dh-text)]">{rel.tag}</span>
                  {rel.name && (
                    <span className="truncate text-[var(--dh-text-secondary)]">{rel.name}</span>
                  )}
                  <span className="ml-auto text-[11px] text-[var(--dh-text-secondary)]">
                    {new Date(rel.publishedAt).toLocaleDateString()}
                  </span>
                </div>
                {rel.assets.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {rel.assets.map((a) => (
                      <a
                        key={a.downloadUrl}
                        href={a.downloadUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={[
                          "flex items-center gap-1.5 rounded-md border px-2 py-1 text-[12px]",
                          a.isApk
                            ? "border-green-600/50 bg-green-600/10 text-green-700 dark:text-green-300 hover:bg-green-600/20"
                            : a.isInstaller
                              ? "border-blue-600/40 bg-blue-600/10 text-blue-700 dark:text-blue-300 hover:bg-blue-600/20"
                              : "border-[var(--dh-window-border)] bg-[var(--dh-surface-hover)] text-[var(--dh-text-secondary)] hover:bg-[var(--dh-surface-selected)]",
                        ].join(" ")}
                      >
                        <FileIcon width={12} height={12} />
                        <span className="max-w-[160px] truncate">{a.name}</span>
                        <span className="text-[10px] text-[var(--dh-text-secondary)]">
                          {formatBytes(a.size)}
                        </span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
