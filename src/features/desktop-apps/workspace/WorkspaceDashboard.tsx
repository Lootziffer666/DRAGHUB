"use client";

import { useEffect, useState } from "react";
import { useChanges } from "@/features/changes";
import { useWindowManager } from "@/features/desktop/WindowManagerProvider";
import { fetchRecentCommits, type RecentCommit } from "@/lib/github";
import {
  fetchRepoDetails,
  listBranches,
  type RepoDetails,
  type BranchSummary,
} from "@/features/desktop-apps/settings/api";
import { listPulls, type PullRequestSummary } from "@/features/pulls/api";
import { classifyPr } from "@/features/pulls/classify";
import { searchRelatedRepos, type SearchRepo } from "@/features/search/github-search";
import { fetchRecentWorkflowRuns, fetchSecurityGlance, type WorkflowRunSummary, type SecurityGlance } from "./api";
import {
  BranchForkRegular as BranchIcon,
  RecordRegular as CommitIcon,
  BranchRequestRegular as PrIcon,
  ArrowSyncRegular as ChangesIcon,
  FlashRegular as ChecksIcon,
  ShieldCheckmarkRegular as SecurityIcon,
  WarningRegular as DecisionIcon,
  CheckmarkCircleRegular as ClearIcon,
  ClockRegular as RecentIcon,
  OpenRegular as ExternalLink,
  FolderOpenRegular as FilesIcon,
  Spinner,
} from "@/features/icons";

type Meta = { owner: string; repo: string; repoKey: string; branch: string; htmlUrl: string };

/**
 * The repository window's DEFAULT view: task-oriented project state, not a
 * GitHub-website clone. "Code / Pull Requests / Issues / Actions / Releases
 * / Security / Settings" are deliberately NOT primary navigation here — they
 * stay reachable as secondary tools (RubberBand), while this dashboard
 * answers "what is this, what's happening, what needs a decision, what
 * should I do next" up front.
 */
export function WorkspaceDashboard({ windowId, meta }: { windowId: string; meta: Meta }) {
  const wm = useWindowManager();
  const { changes } = useChanges();
  const { owner, repo, repoKey, branch, htmlUrl } = meta;

  const [details, setDetails] = useState<RepoDetails | null>(null);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [branches, setBranches] = useState<BranchSummary[] | null>(null);
  const [pulls, setPulls] = useState<PullRequestSummary[] | null>(null);
  const [pullsError, setPullsError] = useState<string | null>(null);
  const [commits, setCommits] = useState<RecentCommit[] | null>(null);
  const [runs, setRuns] = useState<WorkflowRunSummary[] | null>(null);
  const [security, setSecurity] = useState<SecurityGlance | null>(null);
  const [related, setRelated] = useState<SearchRepo[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setDetails(null);
    setDetailsError(null);
    setBranches(null);
    setPulls(null);
    setPullsError(null);
    setCommits(null);
    setRuns(null);
    setSecurity(null);
    setRelated(null);

    fetchRepoDetails(owner, repo)
      .then((d) => !cancelled && setDetails(d))
      .catch((e) => !cancelled && setDetailsError(e instanceof Error ? e.message : "Unavailable"));
    listBranches(owner, repo).then((b) => !cancelled && setBranches(b)).catch(() => !cancelled && setBranches([]));
    listPulls(owner, repo)
      .then((p) => !cancelled && setPulls(p))
      .catch((e) => !cancelled && setPullsError(e instanceof Error ? e.message : "Unavailable"));
    fetchRecentCommits(owner, repo, branch).then((c) => !cancelled && setCommits(c)).catch(() => !cancelled && setCommits([]));
    fetchRecentWorkflowRuns(owner, repo).then((r) => !cancelled && setRuns(r)).catch(() => !cancelled && setRuns([]));
    fetchSecurityGlance(owner, repo).then((s) => !cancelled && setSecurity(s)).catch(() => !cancelled && setSecurity(null));
    searchRelatedRepos(owner, repo).then((r) => !cancelled && setRelated(r.slice(0, 4))).catch(() => !cancelled && setRelated([]));

    return () => {
      cancelled = true;
    };
  }, [owner, repo, branch]);

  const openFiles = (path?: string) =>
    wm.openRepositoryChild(
      windowId,
      "github-feature",
      { type: "github-feature", repoKey, featureId: "files" },
      `${repo} — Files`,
    );

  const openFeature = (featureId: string, label: string) =>
    wm.openRepositoryChild(
      windowId,
      "github-feature",
      { type: "github-feature", repoKey, featureId },
      `${repo} — ${label}`,
    );

  const conflictPulls = (pulls ?? []).filter((p) => classifyPr(p) === "conflict");
  const reviewPulls = (pulls ?? []).filter((p) => classifyPr(p) === "needs-review");
  const cleanPulls = (pulls ?? []).filter((p) => classifyPr(p) === "clean");
  const failingRuns = (runs ?? []).filter((r) => r.conclusion === "failure");
  const activeRuns = (runs ?? []).filter((r) => r.status === "in_progress" || r.status === "queued");
  const securityFindings = security ? [security.dependabotOpen, security.codeScanningOpen, security.secretScanningOpen].filter(Boolean).length : 0;

  const decisionCount = conflictPulls.length + failingRuns.length + securityFindings;

  return (
    <div className="dh-workspace h-full overflow-auto bg-[var(--dh-surface)]">
      <WorkspaceHeader meta={meta} onOpenFeature={openFeature} />

      <div className="mx-auto flex max-w-5xl flex-col gap-5 p-5">
        {/* 1. Project identity */}
        <Section title="Project identity" icon={<BranchIcon width={16} height={16} />}>
          {detailsError ? (
            <ErrorNote message={detailsError} />
          ) : !details ? (
            <LoadingNote label="project details" />
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Pill tone={details.archived ? "warning" : "neutral"}>
                  {details.archived ? "Archived" : details.visibility}
                </Pill>
                {details.license && <Pill tone="neutral">{details.license}</Pill>}
                <Pill tone="neutral">
                  <BranchIcon width={12} height={12} /> {branches?.length ?? "…"} branches
                </Pill>
                <span className="text-xs text-[var(--dh-text-secondary)]">
                  updated {relativeTime(details.pushedAt)}
                </span>
              </div>
              <p className="text-sm text-[var(--dh-text)]">
                {details.description || "No description provided."}
              </p>
              {details.topics.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {details.topics.map((t) => (
                    <span key={t} className="rounded-full bg-[var(--dh-surface-hover)] px-2 py-0.5 text-[11px] text-[var(--dh-text-secondary)]">
                      {t}
                    </span>
                  ))}
                </div>
              )}
              {related && related.length > 0 && (
                <div>
                  <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-[var(--dh-text-secondary)]">
                    Connected repositories
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {related.map((r) => (
                      <a
                        key={r.id}
                        href={r.htmlUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 rounded-md border border-[var(--dh-window-border)] bg-[var(--dh-surface-raised)] px-2 py-1 text-xs text-[var(--dh-text)] hover:border-[var(--dh-window-border-active)]"
                      >
                        {r.fullName}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </Section>

        {/* 2. Current activity */}
        <Section title="Current activity" icon={<ChangesIcon width={16} height={16} />}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ActivityCard
              label="Pull requests"
              value={pulls === null ? null : pulls.length}
              detail={pulls ? `${cleanPulls.length} ready · ${reviewPulls.length} in review · ${conflictPulls.length} conflicted` : undefined}
              error={pullsError}
              icon={<PrIcon width={14} height={14} />}
              onClick={() => openFeature("pull-requests", "Pull Requests")}
            />
            <ActivityCard
              label="Checks"
              value={runs === null ? null : runs.length}
              detail={runs ? `${activeRuns.length} running · ${failingRuns.length} failing` : undefined}
              icon={<ChecksIcon width={14} height={14} />}
              onClick={() => openFeature("actions", "Actions")}
            />
            <ActivityCard
              label="Working changes"
              value={changes.length}
              detail={changes.length > 0 ? "not yet committed" : "clean"}
              icon={<ChangesIcon width={14} height={14} />}
              onClick={() => openFeature("changes", "Changes")}
            />
            <ActivityCard
              label="Security"
              value={security === null ? null : securityFindings}
              detail={security ? (securityFindings > 0 ? "open findings" : "no open findings") : undefined}
              icon={<SecurityIcon width={14} height={14} />}
              onClick={() => openFeature("security", "Security")}
            />
          </div>

          <div className="mt-3">
            <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-[var(--dh-text-secondary)]">
              Recent changes
            </div>
            {commits === null ? (
              <LoadingNote label="recent commits" />
            ) : commits.length === 0 ? (
              <EmptyNote>No recent commits on {branch}.</EmptyNote>
            ) : (
              <ul className="flex flex-col gap-1">
                {commits.slice(0, 6).map((c) => (
                  <li key={c.sha}>
                    <a
                      href={c.htmlUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-[var(--dh-surface-hover)]"
                    >
                      <CommitIcon width={10} height={10} className="shrink-0 text-[var(--dh-text-disabled)]" />
                      <span className="min-w-0 flex-1 truncate text-[var(--dh-text)]">{c.message}</span>
                      {c.isBot && <Pill tone="neutral">agent</Pill>}
                      <span className="shrink-0 text-[11px] text-[var(--dh-text-secondary)]">{c.author}</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Section>

        {/* 3. Decisions required */}
        <Section
          title="Decisions required"
          icon={decisionCount > 0 ? <DecisionIcon width={16} height={16} className="text-amber-600 dark:text-amber-400" /> : <ClearIcon width={16} height={16} className="text-emerald-600 dark:text-emerald-400" />}
        >
          {pulls === null && runs === null && security === null ? (
            <LoadingNote label="decisions" />
          ) : decisionCount === 0 ? (
            <EmptyNote>Nothing is blocked. All clear.</EmptyNote>
          ) : (
            <ul className="flex flex-col gap-2">
              {conflictPulls.map((p) => (
                <DecisionRow
                  key={`conflict-${p.number}`}
                  tone="danger"
                  title={`#${p.number} ${p.title}`}
                  note="merge conflict — needs routing before it can land"
                  actionLabel="Resolve conflict"
                  onAction={() => window.open(p.htmlUrl, "_blank", "noreferrer")}
                />
              ))}
              {failingRuns.map((r) => (
                <DecisionRow
                  key={`run-${r.id}`}
                  tone="danger"
                  title={r.name ?? "Workflow"}
                  note={`failed on ${r.headBranch}`}
                  actionLabel="Inspect evidence"
                  onAction={() => window.open(r.htmlUrl, "_blank", "noreferrer")}
                />
              ))}
              {securityFindings > 0 && (
                <DecisionRow
                  tone="warning"
                  title="Security findings open"
                  note="Dependabot / code scanning / secret scanning has something to review"
                  actionLabel="Inspect evidence"
                  onAction={() => openFeature("security", "Security")}
                />
              )}
            </ul>
          )}
        </Section>

        {/* 4. Next useful actions */}
        <Section title="Next useful actions" icon={<RecentIcon width={16} height={16} />}>
          <div className="flex flex-wrap gap-2">
            {changes.length > 0 && (
              <ActionChip label="Continue work" detail={`${changes.length} pending`} onClick={() => openFeature("changes", "Changes")} />
            )}
            {reviewPulls.length > 0 && (
              <ActionChip label="Review changes" detail={`${reviewPulls.length} PR${reviewPulls.length === 1 ? "" : "s"}`} onClick={() => openFeature("pull-requests", "Pull Requests")} />
            )}
            {conflictPulls.length > 0 && (
              <ActionChip label="Resolve conflict" detail={`${conflictPulls.length}`} onClick={() => window.open(conflictPulls[0].htmlUrl, "_blank", "noreferrer")} />
            )}
            {activeRuns.length > 0 || failingRuns.length > 0 ? (
              <ActionChip label="Inspect evidence" detail="checks" onClick={() => openFeature("actions", "Actions")} />
            ) : null}
            <ActionChip label="Browse files" detail="open implementation target" onClick={() => openFiles()} />
            {changes.length === 0 && reviewPulls.length === 0 && conflictPulls.length === 0 && (
              <ActionChip label="Open a file" detail="start something new" onClick={() => openFiles()} />
            )}
          </div>
        </Section>

        {/* 5. Repository content — secondary, opened intentionally */}
        <Section title="Repository content" icon={<FilesIcon width={16} height={16} />}>
          <p className="mb-2 text-sm text-[var(--dh-text-secondary)]">
            File browsing and code editing stay available as a dedicated tool — opened on
            purpose, not the default view of this window.
          </p>
          <button
            onClick={() => openFiles()}
            className="flex items-center gap-2 rounded-md bg-[var(--dh-accent)] px-3 py-1.5 text-sm font-medium text-[var(--dh-accent-foreground)] hover:opacity-90"
          >
            <FilesIcon width={14} height={14} /> Browse files
          </button>
        </Section>

        <a
          href={htmlUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 self-start text-xs text-[var(--dh-text-secondary)] hover:text-[var(--dh-text)]"
        >
          <ExternalLink width={12} height={12} /> Open {repoKey} on GitHub
        </a>
      </div>
    </div>
  );
}

function WorkspaceHeader({
  meta,
  onOpenFeature,
}: {
  meta: Meta;
  onOpenFeature: (featureId: string, label: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 border-b border-[var(--dh-window-border)] bg-[var(--dh-surface-raised)] px-4 py-2.5">
      <span className="text-sm font-semibold text-[var(--dh-text)]">{meta.repoKey}</span>
      <span className="flex items-center gap-1 rounded-md border border-[var(--dh-window-border)] px-2 py-0.5 text-xs text-[var(--dh-text-secondary)]">
        <BranchIcon width={12} height={12} /> {meta.branch}
      </span>
      <div className="ml-auto flex items-center gap-1">
        <button
          onClick={() => onOpenFeature("settings", "Settings")}
          className="rounded-md px-2 py-1 text-xs text-[var(--dh-text-secondary)] hover:bg-[var(--dh-surface-hover)] hover:text-[var(--dh-text)]"
        >
          Settings
        </button>
      </div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-[var(--dh-window-border)] bg-[var(--dh-surface-raised)] p-4">
      <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-[var(--dh-text)]">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}

function Pill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "warning" | "danger" }) {
  const toneClass =
    tone === "danger"
      ? "bg-red-500/15 text-red-700 dark:text-red-400"
      : tone === "warning"
        ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
        : "bg-[var(--dh-surface-hover)] text-[var(--dh-text-secondary)]";
  return (
    <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${toneClass}`}>
      {children}
    </span>
  );
}

function ActivityCard({
  label,
  value,
  detail,
  error,
  icon,
  onClick,
}: {
  label: string;
  value: number | null;
  detail?: string;
  error?: string | null;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-start gap-1 rounded-md border border-[var(--dh-window-border)] bg-[var(--dh-surface)] px-3 py-2 text-left hover:border-[var(--dh-window-border-active)]"
    >
      <span className="flex items-center gap-1.5 text-xs text-[var(--dh-text-secondary)]">
        {icon} {label}
      </span>
      {error ? (
        <span className="text-xs text-red-600 dark:text-red-400">{error}</span>
      ) : value === null ? (
        <Spinner width={14} height={14} className="text-blue-700 dark:text-blue-400" />
      ) : (
        <span className="text-lg font-semibold text-[var(--dh-text)]">{value}</span>
      )}
      {detail && !error && <span className="text-[11px] text-[var(--dh-text-secondary)]">{detail}</span>}
    </button>
  );
}

function DecisionRow({
  tone,
  title,
  note,
  actionLabel,
  onAction,
}: {
  tone: "danger" | "warning";
  title: string;
  note: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <li
      className={[
        "flex items-center gap-3 rounded-md border px-3 py-2",
        tone === "danger"
          ? "border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30"
          : "border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30",
      ].join(" ")}
    >
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-[var(--dh-text)]">{title}</div>
        <div className="truncate text-xs text-[var(--dh-text-secondary)]">{note}</div>
      </div>
      <button
        onClick={onAction}
        className="shrink-0 rounded-md bg-[var(--dh-accent)] px-2.5 py-1 text-xs font-medium text-[var(--dh-accent-foreground)] hover:opacity-90"
      >
        {actionLabel}
      </button>
    </li>
  );
}

function ActionChip({ label, detail, onClick }: { label: string; detail: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 rounded-full border border-[var(--dh-window-border)] bg-[var(--dh-surface)] px-3 py-1.5 text-sm text-[var(--dh-text)] hover:border-[var(--dh-window-border-active)]"
    >
      {label}
      <span className="rounded-full bg-[var(--dh-surface-hover)] px-1.5 py-0.5 text-[10px] text-[var(--dh-text-secondary)]">{detail}</span>
    </button>
  );
}

function LoadingNote({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-[var(--dh-text-secondary)]">
      <Spinner width={14} height={14} className="text-blue-700 dark:text-blue-400" /> Loading {label}…
    </div>
  );
}

function ErrorNote({ message }: { message: string }) {
  return <p className="text-sm text-red-600 dark:text-red-400">{message}</p>;
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-[var(--dh-text-disabled)]">{children}</p>;
}

function relativeTime(iso: string): string {
  if (!iso) return "unknown";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 60) return `${Math.max(mins, 0)}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
