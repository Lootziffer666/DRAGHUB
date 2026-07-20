"use client";

import { useEffect, useState } from "react";
import { RepoScope, useStore } from "@/lib/store";
import { ghRequest } from "@/lib/github";
import { ChangesProvider } from "@/features/changes";
import { ChangesPanelBody } from "@/features/changes/ChangesPanel";
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
import { Spinner } from "@/components/icons";
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
export function GithubFeatureApp({ resource }: WindowContentProps) {
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
    default:
      return (
        <div className="flex h-full flex-col items-center justify-center gap-2 bg-neutral-950 p-6 text-center">
          <p className="text-sm text-neutral-300 capitalize">
            {featureId.replaceAll("-", " ")}
          </p>
          <p className="max-w-sm text-xs text-neutral-500">
            This surface is not integrated into the desktop yet. It stays a
            deferred feature per the post-PR8 integration brief.
          </p>
          <a
            className="text-xs text-blue-400 hover:underline"
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
      <Spinner width={20} height={20} className="text-blue-400" />
      <p className="text-sm text-neutral-400">Waiting for repository {repoKey}…</p>
    </Center>
  );
}

function ChangesWindow({ repoKey }: { repoKey: string }) {
  const resolved = useCanonicalRepo(repoKey);
  if (!resolved) return <WaitingForRepo repoKey={repoKey} />;
  return (
    <RepoScope repoKey={resolved.key}>
      <ChangesProvider>
        <div className="flex h-full flex-col bg-neutral-900">
          <ChangesPanelBody />
        </div>
      </ChangesProvider>
    </RepoScope>
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
  return view === "releases" ? (
    <ReleasesView owner={meta.owner} repo={meta.repo} branch={meta.branch} />
  ) : (
    <RepoSettingsView owner={meta.owner} repo={meta.repo} branch={meta.branch} />
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
    <div className="h-full overflow-auto bg-neutral-950 p-3">
      {loading && <Loading label="pull requests" />}
      {error && <ErrorBox message={error} />}
      {!loading && !error && items.length === 0 && (
        <p className="p-4 text-center text-sm text-neutral-600">No open pull requests.</p>
      )}
      <div className="space-y-2">
        {items.map((pr) => (
          <div key={pr.number} className="rounded-lg border border-neutral-800 bg-neutral-900 p-3">
            <div className="flex gap-2">
              <span className="text-blue-300">#{pr.number}</span>
              <a
                href={pr.htmlUrl}
                target="_blank"
                rel="noreferrer"
                className="flex-1 text-sm text-neutral-100 hover:underline"
              >
                {pr.title}
              </a>
              <span className="rounded bg-neutral-800 px-2 py-0.5 text-xs text-neutral-300">
                {classifyPr(pr)}
              </span>
            </div>
            <div className="mt-1 text-xs text-neutral-500">
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
                className="rounded bg-neutral-800 px-2 py-1 text-xs text-neutral-200 hover:bg-neutral-700"
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
    <div className="h-full overflow-auto bg-neutral-950 p-3">
      {loading && <Loading label="issues" />}
      {error && <ErrorBox message={error} />}
      {!loading && !error && items.length === 0 && (
        <p className="p-4 text-center text-sm text-neutral-600">No open issues.</p>
      )}
      <div className="space-y-2">
        {items.map((i) => (
          <div key={i.number} className="rounded-lg border border-neutral-800 bg-neutral-900 p-3">
            <div className="flex gap-2">
              <span className="text-emerald-300">#{i.number}</span>
              <a
                href={i.htmlUrl}
                target="_blank"
                rel="noreferrer"
                className="flex-1 text-sm text-neutral-100 hover:underline"
              >
                {i.title}
              </a>
            </div>
            <div className="mt-1 text-xs text-neutral-500">
              {i.user} · {i.comments} comments · {i.labels.join(", ") || "no labels"}
            </div>
            <button
              onClick={() =>
                closeIssue(owner, repo, i.number)
                  .then(() => setItems((v) => v.filter((x) => x.number !== i.number)))
                  .catch((e) => setError(String(e)))
              }
              className="mt-2 rounded bg-neutral-800 px-2 py-1 text-xs text-neutral-200 hover:bg-neutral-700"
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
    <div className="h-full overflow-auto bg-neutral-950 p-3">
      {loading && <Loading label="workflow runs" />}
      {error && <ErrorBox message={error} />}
      {!loading && !error && runs.length === 0 && (
        <p className="p-4 text-center text-sm text-neutral-600">No workflow runs.</p>
      )}
      <div className="space-y-1.5">
        {runs.map((r) => (
          <a
            key={r.id}
            href={r.html_url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 hover:border-neutral-600"
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
            <span className="min-w-0 flex-1 truncate text-sm text-neutral-200">
              {r.name ?? "Workflow"} #{r.run_number}
            </span>
            <span className="shrink-0 text-xs text-neutral-500">
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
    <div className="flex items-center justify-center gap-2 p-6 text-sm text-neutral-500">
      <Spinner width={16} height={16} className="text-blue-400" /> Loading {label}…
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <p className="rounded border border-red-900 bg-red-950/40 p-2 text-sm text-red-300">
      {message}
    </p>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 bg-neutral-950 p-6 text-center">
      {children}
    </div>
  );
}
