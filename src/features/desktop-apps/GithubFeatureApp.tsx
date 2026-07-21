"use client";

import { useEffect, useState } from "react";
import { RepoScope, useActiveRepo, useStore } from "@/lib/store";
import { parseRepoInput, ghRequest } from "@/lib/github";
import { ChangesProvider, useChanges } from "@/features/changes";
import { ChangesPanelBody } from "@/features/changes/ChangesPanel";
import { UIProvider } from "@/components/ui-context";
import { AddressBar } from "@/components/AddressBar";
import { Explorer } from "@/components/Explorer";
import { Tabs } from "@/components/Tabs";
import { FileView } from "@/components/FileView";
import { useWindowManager } from "@/features/desktop/WindowManagerProvider";
import { OpenWithMenu } from "./file-handlers";
import type { FileHandlerDefinition } from "./file-handlers";
import {
  listPulls,
  mergePull,
  closePull,
  type PullRequestSummary,
} from "@/features/pulls/api";
import { classifyPr } from "@/features/pulls/classify";
import {
  listIssues,
  closeIssue,
  type IssueSummary,
} from "@/features/issues/api";
import {
  BranchForkRegular as GitBranch,
  RecordRegular as GitCommit,
  DocumentRegular as FileIcon,
  Spinner,
} from "@/features/icons";
import {
  TriageView,
  SecurityView,
  ReleasesView,
  RepoSettingsView,
} from "./feature-views";
import type { WindowContentProps } from "@/features/desktop/types";

/**
 * Repository-owned GitHub feature child windows (Stage 3). The feature is
 * bound to the window's `github-feature` resource — owner/repo come from the
 * resource's repoKey, never from a globally focused repository.
 */
export function GithubFeatureApp({ windowId, resource }: WindowContentProps) {
  if (resource.type !== "github-feature") return null;
  const { repoKey, featureId } = resource;
  const [owner, repoName] = repoKey.split("/");

  switch (featureId) {
    case "pull-requests":
      return <PullsView owner={owner} repo={repoName} />;
    case "issues":
      return <IssuesView owner={owner} repo={repoName} />;
    case "actions":
      return <ActionsView owner={owner} repo={repoName} />;
    case "changes":
      return <ChangesWindow repoKey={repoKey} />;
    case "triage":
      return <TriageView owner={owner} repo={repoName} />;
    case "security":
      return <SecurityWindow repoKey={repoKey} />;
    case "releases":
      return <BranchAwareView repoKey={repoKey} view="releases" />;
    case "settings":
      return <BranchAwareView repoKey={repoKey} view="settings" />;
    case "files":
      return <FilesWindow windowId={windowId} repoKey={repoKey} />;
    default:
      return (
        <div className="flex h-full flex-col items-center justify-center gap-2 bg-[var(--dh-surface)] p-6 text-center">
          <p className="text-sm text-[var(--dh-text-secondary)] capitalize">
            {featureId.replaceAll("-", " ")}
          </p>
          <p className="max-w-sm text-xs text-[var(--dh-text-secondary)]">
            This surface is not integrated into the desktop yet. It stays a
            deferred feature per the post-PR8 integration brief.
          </p>
          <a
            className="text-xs text-blue-700 dark:text-blue-400 hover:underline"
            href={`https://github.com/${repoKey}`}
            target="_blank"
            rel="noreferrer"
          >
            Open {repoKey} on GitHub
          </a>
        </div>
      );
  }
}

/** Resolves the possibly differently-cased resource repoKey against loaded
 * repositories; null while the owning repository window is still hydrating. */
function useCanonicalRepo(repoKey: string) {
  const { state } = useStore();
  const canonical =
    (state.repos[repoKey]
      ? repoKey
      : Object.keys(state.repos).find(
          (k) => k.toLowerCase() === repoKey.toLowerCase()
        )) ?? null;
  return canonical ? { key: canonical, repo: state.repos[canonical] } : null;
}

function WaitingForRepo({ repoKey }: { repoKey: string }) {
  return (
    <Center>
      <Spinner width={20} height={20} className="text-blue-700 dark:text-blue-400" />
      <p className="text-sm text-[var(--dh-text-secondary)]">Waiting for repository {repoKey}…</p>
    </Center>
  );
}

function ChangesWindow({ repoKey }: { repoKey: string }) {
  const resolved = useCanonicalRepo(repoKey);
  if (!resolved) return <WaitingForRepo repoKey={repoKey} />;
  return (
    <RepoScope repoKey={resolved.key}>
      <ChangesProvider>
        <div className="flex h-full flex-col bg-[var(--dh-surface-raised)]">
          <ChangesPanelBody />
        </div>
      </ChangesProvider>
    </RepoScope>
  );
}

/**
 * The "Files" tool — file browsing and code editing, moved out of the
 * repository window's default view (native workspace redesign) into a
 * secondary window opened intentionally from the dashboard or RubberBand.
 * This is the same Explorer/Tabs/FileView machinery the repository window
 * used to render by default; only where it's mounted changed.
 */
function FilesWindow({ windowId, repoKey }: { windowId: string; repoKey: string }) {
  const resolved = useCanonicalRepo(repoKey);
  if (!resolved) return <WaitingForRepo repoKey={repoKey} />;
  return (
    <RepoScope repoKey={resolved.key}>
      <ChangesProvider>
        <UIProvider>
          <FilesWindowBody windowId={windowId} />
        </UIProvider>
      </ChangesProvider>
    </RepoScope>
  );
}

function FilesWindowBody({ windowId }: { windowId: string }) {
  const wm = useWindowManager();
  const repo = useActiveRepo();
  const changes = useChanges();
  if (!repo) return null;
  const repoKey = repo.meta.fullName;
  const activeTab = repo.tabs.find((t) => t.id === repo.activeTabId);

  const openRepoInWindow = (input: string) => {
    const parsed = parseRepoInput(input);
    if (!parsed) return;
    const key = `${parsed.owner}/${parsed.repo}`;
    wm.openOrFocusWindow({
      applicationId: "repository-explorer",
      owner: { type: "desktop" },
      resource: { type: "repository", repoKey: key },
      title: key,
    });
  };

  return (
    <div className="flex h-full flex-col bg-[var(--dh-surface)] text-[var(--dh-text)]">
      <AddressBar
        onGoHome={() => wm.minimizeWindow(windowId)}
        onOpenRepo={openRepoInWindow}
        onCloseRepo={() => wm.requestCloseWindow(windowId)}
      />
      <div className="flex items-center gap-2 border-b border-[var(--dh-window-border)] bg-[var(--dh-surface)] px-3 py-1.5">
        <button
          onClick={() =>
            wm.openRepositoryChild(
              windowId,
              "github-feature",
              { type: "github-feature", repoKey, featureId: "changes" },
              `${repo.meta.repo} — Changes`
            )
          }
          title="Working changes"
          className="relative flex items-center gap-1.5 rounded-md border border-[var(--dh-window-border)] bg-[var(--dh-surface)] px-2.5 py-1 text-xs text-[var(--dh-text-secondary)] hover:border-[var(--dh-window-border-active)]"
        >
          <GitCommit
            width={13}
            height={13}
            className={changes.changes.length > 0 ? "text-amber-700 dark:text-amber-400" : "text-[var(--dh-text-secondary)]"}
          />
          Changes
          {changes.changes.length > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-semibold text-black">
              {changes.changes.length}
            </span>
          )}
        </button>
        {activeTab?.kind === "file" && (
          <OpenWithMenu
            resource={{ repoKey, path: activeTab.path, size: activeTab.size }}
            meta={{ owner: repo.meta.owner, repo: repo.meta.repo, branch: repo.meta.branch }}
            onOpenHandler={(handler: FileHandlerDefinition) =>
              wm.openRepositoryChild(
                windowId,
                handler.applicationId,
                { type: "file", repoKey, path: activeTab.path },
                activeTab.label
              )
            }
          />
        )}
        <span className="ml-auto truncate text-[11px] text-[var(--dh-text-disabled)]">{repoKey}</span>
      </div>
      <div className="flex min-h-0 flex-1">
        <aside className="w-64 shrink-0 border-r border-[var(--dh-window-border)] max-md:hidden">
          <Explorer />
        </aside>
        <main className="flex min-w-0 flex-1 flex-col">
          <Tabs />
          <div className="min-h-0 flex-1">
            <FileView />
          </div>
        </main>
      </div>
      <div className="flex items-center gap-4 border-t border-[var(--dh-window-border)] bg-[var(--dh-surface)] px-3 py-1 text-[11px] text-[var(--dh-text-secondary)]">
        <span className="flex items-center gap-1">
          <GitBranch width={12} height={12} />
          {repo.meta.branch}
        </span>
        {activeTab && (
          <span className="flex items-center gap-1 truncate">
            <FileIcon width={12} height={12} />
            <span className="truncate">{activeTab.path || "/"}</span>
          </span>
        )}
        <span className="ml-auto">
          {repo.selection.length > 0
            ? `${repo.selection.length} selected`
            : `${repo.tabs.length} tab${repo.tabs.length === 1 ? "" : "s"}`}
        </span>
      </div>
    </div>
  );
}

function SecurityWindow({ repoKey }: { repoKey: string }) {
  const resolved = useCanonicalRepo(repoKey);
  if (!resolved) return <WaitingForRepo repoKey={repoKey} />;
  const meta = resolved.repo.meta;
  return (
    <RepoScope repoKey={resolved.key}>
      <ChangesProvider>
        <SecurityView owner={meta.owner} repo={meta.repo} branch={meta.branch} />
      </ChangesProvider>
    </RepoScope>
  );
}

function BranchAwareView({
  repoKey,
  view,
}: {
  repoKey: string;
  view: "releases" | "settings";
}) {
  const resolved = useCanonicalRepo(repoKey);
  if (!resolved) return <WaitingForRepo repoKey={repoKey} />;
  const meta = resolved.repo.meta;
  if (view === "releases") {
    return <ReleasesView owner={meta.owner} repo={meta.repo} branch={meta.branch} />;
  }
  // Settings' "People & Access" category stages CODEOWNERS as a normal
  // working change via useChanges(), same as SecurityWindow's scope below.
  return (
    <RepoScope repoKey={resolved.key}>
      <ChangesProvider>
        <RepoSettingsView owner={meta.owner} repo={meta.repo} branch={meta.branch} />
      </ChangesProvider>
    </RepoScope>
  );
}

function PullsView({ owner, repo }: { owner: string; repo: string }) {
  const [items, setItems] = useState<PullRequestSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError(null);
    listPulls(owner, repo)
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load PRs"))
      .finally(() => setLoading(false));
  }, [owner, repo]);

  return (
    <div className="h-full overflow-auto bg-[var(--dh-surface)] p-3">
      {loading && <Loading label="pull requests" />}
      {error && <ErrorBox message={error} />}
      {!loading && !error && items.length === 0 && (
        <p className="p-4 text-center text-sm text-[var(--dh-text-disabled)]">No open pull requests.</p>
      )}
      <div className="space-y-2">
        {items.map((pr) => (
          <div key={pr.number} className="rounded-lg border border-[var(--dh-window-border)] bg-[var(--dh-surface-raised)] p-3">
            <div className="flex gap-2">
              <span className="text-blue-700 dark:text-blue-300">#{pr.number}</span>
              <a
                href={pr.htmlUrl}
                target="_blank"
                rel="noreferrer"
                className="flex-1 text-sm text-[var(--dh-text)] hover:underline"
              >
                {pr.title}
              </a>
              <span className="rounded bg-[var(--dh-surface-hover)] px-2 py-0.5 text-xs text-[var(--dh-text-secondary)]">
                {classifyPr(pr)}
              </span>
            </div>
            <div className="mt-1 text-xs text-[var(--dh-text-secondary)]">
              {pr.user} · {pr.changedFiles} files · +{pr.additions}/-{pr.deletions}
            </div>
            <div className="mt-2 flex gap-2">
              <button
                onClick={() =>
                  mergePull(owner, repo, pr.number)
                    .then(() => setItems((v) => v.filter((x) => x.number !== pr.number)))
                    .catch((e) => setError(String(e)))
                }
                className="rounded bg-green-700 px-2 py-1 text-xs text-white hover:bg-green-600"
              >
                Merge
              </button>
              <button
                onClick={() =>
                  closePull(owner, repo, pr.number)
                    .then(() => setItems((v) => v.filter((x) => x.number !== pr.number)))
                    .catch((e) => setError(String(e)))
                }
                className="rounded bg-[var(--dh-surface-hover)] px-2 py-1 text-xs text-[var(--dh-text)] hover:bg-[var(--dh-surface-selected)]"
              >
                Close
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function IssuesView({ owner, repo }: { owner: string; repo: string }) {
  const [items, setItems] = useState<IssueSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError(null);
    listIssues(owner, repo)
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load issues"))
      .finally(() => setLoading(false));
  }, [owner, repo]);

  return (
    <div className="h-full overflow-auto bg-[var(--dh-surface)] p-3">
      {loading && <Loading label="issues" />}
      {error && <ErrorBox message={error} />}
      {!loading && !error && items.length === 0 && (
        <p className="p-4 text-center text-sm text-[var(--dh-text-disabled)]">No open issues.</p>
      )}
      <div className="space-y-2">
        {items.map((i) => (
          <div key={i.number} className="rounded-lg border border-[var(--dh-window-border)] bg-[var(--dh-surface-raised)] p-3">
            <div className="flex gap-2">
              <span className="text-emerald-700 dark:text-emerald-300">#{i.number}</span>
              <a
                href={i.htmlUrl}
                target="_blank"
                rel="noreferrer"
                className="flex-1 text-sm text-[var(--dh-text)] hover:underline"
              >
                {i.title}
              </a>
            </div>
            <div className="mt-1 text-xs text-[var(--dh-text-secondary)]">
              {i.user} · {i.comments} comments · {i.labels.join(", ") || "no labels"}
            </div>
            <button
              onClick={() =>
                closeIssue(owner, repo, i.number)
                  .then(() => setItems((v) => v.filter((x) => x.number !== i.number)))
                  .catch((e) => setError(String(e)))
              }
              className="mt-2 rounded bg-[var(--dh-surface-hover)] px-2 py-1 text-xs text-[var(--dh-text)] hover:bg-[var(--dh-surface-selected)]"
            >
              Close
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

type WorkflowRun = {
  id: number;
  name: string | null;
  status: string;
  conclusion: string | null;
  html_url: string;
  head_branch: string;
  run_number: number;
  updated_at: string;
};

function ActionsView({ owner, repo }: { owner: string; repo: string }) {
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError(null);
    ghRequest(`/repos/${owner}/${repo}/actions/runs?per_page=15`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Workflow runs unavailable (${res.status}).`);
        const data = await res.json<{ workflow_runs: WorkflowRun[] }>();
        setRuns(data.workflow_runs ?? []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load runs"))
      .finally(() => setLoading(false));
  }, [owner, repo]);

  return (
    <div className="h-full overflow-auto bg-[var(--dh-surface)] p-3">
      {loading && <Loading label="workflow runs" />}
      {error && <ErrorBox message={error} />}
      {!loading && !error && runs.length === 0 && (
        <p className="p-4 text-center text-sm text-[var(--dh-text-disabled)]">No workflow runs.</p>
      )}
      <div className="space-y-1.5">
        {runs.map((r) => (
          <a
            key={r.id}
            href={r.html_url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-lg border border-[var(--dh-window-border)] bg-[var(--dh-surface-raised)] px-3 py-2 hover:border-[var(--dh-window-border-active)]"
          >
            <span
              className={[
                "h-2 w-2 shrink-0 rounded-full",
                r.conclusion === "success"
                  ? "bg-emerald-400"
                  : r.conclusion === "failure"
                    ? "bg-red-400"
                    : "bg-amber-400",
              ].join(" ")}
            />
            <span className="min-w-0 flex-1 truncate text-sm text-[var(--dh-text)]">
              {r.name ?? "Workflow"} #{r.run_number}
            </span>
            <span className="shrink-0 text-xs text-[var(--dh-text-secondary)]">
              {r.head_branch} · {r.conclusion ?? r.status}
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}

function Loading({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-2 p-6 text-sm text-[var(--dh-text-secondary)]">
      <Spinner width={16} height={16} className="text-blue-700 dark:text-blue-400" /> Loading {label}…
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <p className="rounded border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-2 text-sm text-red-600 dark:text-red-300">
      {message}
    </p>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 bg-[var(--dh-surface)] p-6 text-center">
      {children}
    </div>
  );
}
