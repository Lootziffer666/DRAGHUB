"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { formatBytes } from "@/lib/github";
import {
  ExternalLink,
  FileIcon,
  GitBranch,
  GithubMark,
  Search,
  Spinner,
  Star,
  X,
} from "@/components/icons";
import {
  searchRepositories,
  searchRelatedRepos,
  searchReposWithReleases,
  type RepoWithReleases,
  type SearchRepo,
} from "./github-search";

type Mode = "repos" | "related" | "releases";

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

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center bg-black/60 p-4 pt-[8vh] backdrop-blur-sm">
      <div className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-neutral-700 bg-neutral-900 shadow-2xl">
        <div className="flex items-center gap-2 border-b border-neutral-800 px-3 py-2.5">
          <Search width={18} height={18} className="text-neutral-500" />
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
                  : "Search repositories (name, topic, description)…"
            }
            className="flex-1 bg-transparent text-sm text-neutral-100 outline-none placeholder:text-neutral-600"
            spellCheck={false}
          />
          {loading && <Spinner width={16} height={16} className="text-blue-400" />}
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded text-neutral-500 hover:bg-neutral-800 hover:text-neutral-100"
          >
            <X width={16} height={16} />
          </button>
        </div>

        <div className="flex items-center gap-1 border-b border-neutral-800 px-2 py-1.5">
          {modes.map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={[
                "rounded-md px-3 py-1 text-[13px] transition-colors",
                mode === m.id
                  ? "bg-neutral-700 text-neutral-100"
                  : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200",
              ].join(" ")}
            >
              {m.label}
            </button>
          ))}
          {mode === "related" && relatedMeta && (
            <button
              onClick={() => void runRelated()}
              className="ml-auto rounded-md px-2.5 py-1 text-[13px] text-blue-400 hover:bg-neutral-800"
            >
              Refresh
            </button>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-2">
          {error && (
            <div className="m-2 rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-300">
              {error}
            </div>
          )}

          {mode === "related" && !relatedMeta && (
            <div className="p-8 text-center text-sm text-neutral-500">
              Focus a repository, file, or GitHub-feature window to use Related.
            </div>
          )}

          {mode === "repos" && <RepoList repos={repos} onSelect={selectRepo} />}

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
          className="group flex flex-col gap-1 rounded-lg border border-transparent px-3 py-2 text-left hover:border-neutral-700 hover:bg-neutral-800/60"
        >
          <div className="flex items-center gap-2">
            <GithubMark width={15} height={15} className="shrink-0 text-neutral-400" />
            <span className="truncate font-medium text-neutral-100">
              {r.fullName}
            </span>
            <span className="ml-auto flex shrink-0 items-center gap-3 text-[12px] text-neutral-500">
              {r.language && (
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-blue-400" />
                  {r.language}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Star width={12} height={12} className="text-amber-400" />
                {r.stars.toLocaleString()}
              </span>
            </span>
          </div>
          {r.description && (
            <p className="line-clamp-2 text-[13px] text-neutral-400">
              {r.description}
            </p>
          )}
          {r.topics.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {r.topics.slice(0, 5).map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-neutral-800 px-2 py-0.5 text-[11px] text-neutral-400"
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
          className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-3"
        >
          <div className="flex items-center gap-2">
            <button
              onClick={() => onSelectRepo(repo.fullName)}
              className="truncate font-medium text-neutral-100 hover:text-blue-400"
            >
              {repo.fullName}
            </button>
            {hasApk && (
              <span className="rounded bg-green-600/20 px-1.5 py-0.5 text-[11px] font-medium text-green-400">
                APK
              </span>
            )}
            <a
              href={repo.htmlUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="ml-auto text-neutral-500 hover:text-neutral-200"
              title="Open on GitHub"
            >
              <ExternalLink width={14} height={14} />
            </a>
          </div>
          <div className="mt-2 flex flex-col gap-2">
            {rels.map((rel) => (
              <div key={rel.tag} className="rounded-md bg-neutral-900/80 p-2">
                <div className="flex items-center gap-2 text-[13px]">
                  <GitBranch width={13} height={13} className="text-blue-400" />
                  <span className="font-medium text-neutral-200">{rel.tag}</span>
                  {rel.name && (
                    <span className="truncate text-neutral-400">{rel.name}</span>
                  )}
                  <span className="ml-auto text-[11px] text-neutral-500">
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
                            ? "border-green-600/50 bg-green-600/10 text-green-300 hover:bg-green-600/20"
                            : a.isInstaller
                              ? "border-blue-600/40 bg-blue-600/10 text-blue-300 hover:bg-blue-600/20"
                              : "border-neutral-700 bg-neutral-800 text-neutral-300 hover:bg-neutral-700",
                        ].join(" ")}
                      >
                        <FileIcon width={12} height={12} />
                        <span className="max-w-[160px] truncate">{a.name}</span>
                        <span className="text-[10px] text-neutral-500">
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
