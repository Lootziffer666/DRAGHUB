"use client";

import { useEffect, useState } from "react";
import {
  Tab,
  TabList,
  type SelectTabData,
  type SelectTabEvent,
} from "@fluentui/react-components";
import { useActiveRepo } from "@/lib/store";
import { useChanges } from "@/features/changes";
import {
  BranchForkRegular,
  FlashRegular,
  GlobeRegular,
  KeyRegular,
  OpenRegular as ExternalLink,
  PeopleRegular,
  PlugConnectedRegular,
  SettingsRegular,
  ShieldCheckmarkRegular,
  Spinner,
  ToggleLeftRegular,
  WarningRegular,
} from "@/features/icons";
import {
  codeownersTemplate,
  fetchRepoDetails,
  getBranchProtection,
  getCodeScanning,
  getDependabot,
  getPagesInfo,
  getRulesets,
  getSecretScanning,
  getWorkflowPermissions,
  listBranches,
  listCollaborators,
  listRunners,
  listSecretNames,
  listVariables,
  listWebhooks,
  type BranchSummary,
  type Collaborator,
  type Probe,
  type Runner,
  type RepoDetails,
  type SecretName,
  type Variable,
  type Webhook,
} from "./api";

/**
 * The repository Settings window — a category-based control panel per
 * docs/GITHUB_DESKTOP_SHELL_SPEC.md §8.10 ("a category-based control panel,
 * not one endless settings page"). Ten required categories: General,
 * People & Access, Branches & Rules, Actions & Runners, Security,
 * Secrets & Variables, Webhooks & Apps, Pages & Deployments, Features,
 * Danger Zone.
 *
 * Every category that talks to the GitHub API reports a live scope-probe
 * result (never derived from parsing the token — PATs aren't
 * self-describing) and stays visible-but-disabled on a missing scope
 * instead of silently failing, per PLAN.md's M10 acceptance criterion.
 * No category performs a destructive write (branch-protection edits,
 * secret writes, repository deletion/transfer/archival) — those aren't
 * concretely specified anywhere in the project docs and stay an
 * explicit "open on GitHub" action instead of an invented one.
 */

type CategoryId =
  | "general"
  | "access"
  | "branches"
  | "actions"
  | "security"
  | "secrets"
  | "webhooks"
  | "pages"
  | "features"
  | "danger";

const CATEGORIES: { id: CategoryId; label: string; icon: typeof SettingsRegular }[] = [
  { id: "general", label: "General", icon: SettingsRegular },
  { id: "access", label: "People & Access", icon: PeopleRegular },
  { id: "branches", label: "Branches & Rules", icon: BranchForkRegular },
  { id: "actions", label: "Actions & Runners", icon: FlashRegular },
  { id: "security", label: "Security", icon: ShieldCheckmarkRegular },
  { id: "secrets", label: "Secrets & Variables", icon: KeyRegular },
  { id: "webhooks", label: "Webhooks & Apps", icon: PlugConnectedRegular },
  { id: "pages", label: "Pages & Deployments", icon: GlobeRegular },
  { id: "features", label: "Features", icon: ToggleLeftRegular },
  { id: "danger", label: "Danger Zone", icon: WarningRegular },
];

export function SettingsPanel({
  owner,
  repo,
  branch,
}: {
  owner: string;
  repo: string;
  branch: string;
}) {
  const [category, setCategory] = useState<CategoryId>("general");

  return (
    <div className="flex h-full bg-[var(--dh-surface)]">
      <TabList
        vertical
        selectedValue={category}
        onTabSelect={(_e: SelectTabEvent, data: SelectTabData) =>
          setCategory(data.value as CategoryId)
        }
        className="w-44 shrink-0 border-r border-[var(--dh-window-border)] bg-[var(--dh-surface-raised)] p-1"
      >
        {CATEGORIES.map(({ id, label, icon: Icon }) => (
          <Tab key={id} value={id} icon={<Icon />}>
            {label}
          </Tab>
        ))}
      </TabList>
      <div className="min-w-0 flex-1 overflow-auto p-4">
        {category === "general" && <GeneralCategory owner={owner} repo={repo} branch={branch} />}
        {category === "access" && <AccessCategory owner={owner} repo={repo} />}
        {category === "branches" && <BranchesCategory owner={owner} repo={repo} branch={branch} />}
        {category === "actions" && <ActionsCategory owner={owner} repo={repo} />}
        {category === "security" && <SecurityCategory owner={owner} repo={repo} branch={branch} />}
        {category === "secrets" && <SecretsCategory owner={owner} repo={repo} />}
        {category === "webhooks" && <WebhooksCategory owner={owner} repo={repo} />}
        {category === "pages" && <PagesCategory owner={owner} repo={repo} />}
        {category === "features" && <FeaturesCategory owner={owner} repo={repo} />}
        {category === "danger" && <DangerZoneCategory owner={owner} repo={repo} />}
      </div>
    </div>
  );
}

// ---- shared presentational helpers ----------------------------------

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2 text-sm font-semibold text-[var(--dh-text)]">{children}</h3>;
}

function LoadingBlock({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-2 p-6 text-sm text-[var(--dh-text-secondary)]">
      <Spinner width={16} height={16} className="text-blue-700 dark:text-blue-400" /> Loading {label}…
    </div>
  );
}

function ErrorBlock({ message }: { message: string }) {
  return (
    <p className="mb-2 rounded border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-2 text-sm text-red-600 dark:text-red-300">
      {message}
    </p>
  );
}

function EmptyBlock({ children }: { children: React.ReactNode }) {
  return <p className="p-4 text-center text-sm text-[var(--dh-text-disabled)]">{children}</p>;
}

function StatusRow({ label, probe }: { label: string; probe: Probe | null }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-[var(--dh-window-border)] bg-[var(--dh-surface-raised)] px-3 py-2">
      <span
        className={[
          "h-2 w-2 shrink-0 rounded-full",
          !probe ? "bg-[var(--dh-window-border-active)]" : probe.ok ? "bg-emerald-400" : "bg-amber-400",
        ].join(" ")}
      />
      <span className="flex-1 text-sm text-[var(--dh-text)]">{label}</span>
      <span className="text-xs text-[var(--dh-text-secondary)]">{probe ? probe.message : "Probing…"}</span>
    </div>
  );
}

function ExternalLinkButton({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 rounded-md border border-[var(--dh-window-border)] bg-[var(--dh-surface-raised)] px-3 py-1.5 text-xs text-[var(--dh-text)] hover:border-[var(--dh-window-border-active)]"
    >
      <ExternalLink width={13} height={13} /> {label}
    </a>
  );
}

// ---- General -----------------------------------------------------------

function GeneralCategory({ owner, repo, branch }: { owner: string; repo: string; branch: string }) {
  const [details, setDetails] = useState<RepoDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDetails(null);
    setError(null);
    fetchRepoDetails(owner, repo)
      .then(setDetails)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load repository details"));
  }, [owner, repo]);

  return (
    <div>
      <SectionTitle>General</SectionTitle>
      {error && <ErrorBlock message={error} />}
      {!details && !error && <LoadingBlock label="repository details" />}
      {details && (
        <div className="space-y-2 text-sm">
          <Row label="Name" value={`${owner}/${repo}`} />
          <Row label="Default branch" value={details.defaultBranch} />
          <Row label="Visibility" value={details.visibility} />
          <Row label="Description" value={details.description ?? "—"} />
          <Row label="Homepage" value={details.homepage ?? "—"} />
          <Row label="Topics" value={details.topics.length ? details.topics.join(", ") : "—"} />
          <Row label="License" value={details.license ?? "—"} />
          <Row label="Open issues" value={String(details.openIssuesCount)} />
          <Row label="Last pushed" value={new Date(details.pushedAt).toLocaleString()} />
        </div>
      )}
      <p className="mt-4 text-xs text-[var(--dh-text-secondary)]">
        Currently viewing branch <code>{branch}</code>. Renaming, transferring or
        changing repository identity stays on GitHub.
      </p>
      <div className="mt-2">
        <ExternalLinkButton href={`https://github.com/${owner}/${repo}/settings`} label="Open repository settings on GitHub" />
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-[var(--dh-window-border)] bg-[var(--dh-surface-raised)] px-3 py-2">
      <span className="w-32 shrink-0 text-[var(--dh-text-secondary)]">{label}</span>
      <span className="min-w-0 flex-1 break-words text-[var(--dh-text)]">{value}</span>
    </div>
  );
}

// ---- People & Access -----------------------------------------------------

function AccessCategory({ owner, repo }: { owner: string; repo: string }) {
  const scoped = useActiveRepo();
  const changes = useChanges();
  const [collaborators, setCollaborators] = useState<Collaborator[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [staged, setStaged] = useState(false);

  useEffect(() => {
    setCollaborators(null);
    setError(null);
    listCollaborators(owner, repo)
      .then(setCollaborators)
      .catch((e) => setError(e instanceof Error ? e.message : "Collaborators unavailable — likely missing scope"));
  }, [owner, repo]);

  const canStage = Boolean(scoped) && !staged;

  return (
    <div>
      <SectionTitle>People & Access</SectionTitle>
      {error && <ErrorBlock message={error} />}
      {!collaborators && !error && <LoadingBlock label="collaborators" />}
      {collaborators && collaborators.length === 0 && <EmptyBlock>No collaborators visible to this token.</EmptyBlock>}
      {collaborators && collaborators.length > 0 && (
        <div className="space-y-1.5">
          {collaborators.map((c) => (
            <a
              key={c.login}
              href={c.htmlUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-lg border border-[var(--dh-window-border)] bg-[var(--dh-surface-raised)] px-3 py-2 hover:border-[var(--dh-window-border-active)]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.avatarUrl} alt="" width={20} height={20} className="rounded-full" />
              <span className="min-w-0 flex-1 truncate text-sm text-[var(--dh-text)]">{c.login}</span>
              <span className="shrink-0 rounded bg-[var(--dh-surface-hover)] px-2 py-0.5 text-xs text-[var(--dh-text-secondary)]">
                {c.permission}
              </span>
            </a>
          ))}
        </div>
      )}
      <div className="mt-4 rounded-lg border border-[var(--dh-window-border)] bg-[var(--dh-surface-raised)] p-3">
        <div className="mb-1 text-sm font-medium text-[var(--dh-text)]">CODEOWNERS</div>
        <p className="mb-2 text-xs text-[var(--dh-text-secondary)]">
          Stages a starter <code>.github/CODEOWNERS</code> as a normal working
          change — nothing commits until you create a checkpoint.
        </p>
        <button
          disabled={!canStage}
          onClick={() => {
            void changes
              .stageAddFile(".github/CODEOWNERS", new TextEncoder().encode(codeownersTemplate(owner)))
              .then(() => setStaged(true));
          }}
          className="rounded-md bg-[var(--dh-accent)] px-3 py-1.5 text-xs font-medium text-[var(--dh-accent-foreground)] hover:opacity-90 disabled:opacity-40"
        >
          {staged ? "Staged ✓" : "Stage CODEOWNERS template"}
        </button>
      </div>
      <p className="mt-3 text-xs text-[var(--dh-text-secondary)]">
        Adding/removing collaborators and managing teams stays on GitHub.
      </p>
      <div className="mt-2">
        <ExternalLinkButton href={`https://github.com/${owner}/${repo}/settings/access`} label="Manage access on GitHub" />
      </div>
    </div>
  );
}

// ---- Branches & Rules ----------------------------------------------------

function BranchesCategory({ owner, repo, branch }: { owner: string; repo: string; branch: string }) {
  const [protection, setProtection] = useState<Probe | null>(null);
  const [rulesets, setRulesets] = useState<Probe | null>(null);
  const [branches, setBranches] = useState<BranchSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getBranchProtection(owner, repo, branch).then(setProtection);
    getRulesets(owner, repo).then(setRulesets);
    setBranches(null);
    setError(null);
    listBranches(owner, repo)
      .then(setBranches)
      .catch((e) => setError(e instanceof Error ? e.message : "Branches unavailable"));
  }, [owner, repo, branch]);

  return (
    <div>
      <SectionTitle>Branches & Rules</SectionTitle>
      <div className="space-y-1.5">
        <StatusRow label={`Branch protection on ${branch}`} probe={protection} />
        <StatusRow label="Rulesets" probe={rulesets} />
      </div>
      <div className="mt-4">
        <div className="mb-2 text-xs font-medium text-[var(--dh-text-secondary)]">Branches</div>
        {error && <ErrorBlock message={error} />}
        {!branches && !error && <LoadingBlock label="branches" />}
        {branches && (
          <div className="space-y-1">
            {branches.map((b) => (
              <div
                key={b.name}
                className="flex items-center gap-2 rounded-lg border border-[var(--dh-window-border)] bg-[var(--dh-surface-raised)] px-3 py-1.5"
              >
                <span className="min-w-0 flex-1 truncate text-sm text-[var(--dh-text)]">{b.name}</span>
                {b.protected && (
                  <span className="shrink-0 rounded bg-[var(--dh-surface-hover)] px-2 py-0.5 text-xs text-[var(--dh-text-secondary)]">
                    protected
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <p className="mt-3 text-xs text-[var(--dh-text-secondary)]">
        Editing protection rules or rulesets stays on GitHub.
      </p>
      <div className="mt-2">
        <ExternalLinkButton href={`https://github.com/${owner}/${repo}/settings/branches`} label="Manage branch rules on GitHub" />
      </div>
    </div>
  );
}

// ---- Actions & Runners -----------------------------------------------------

function ActionsCategory({ owner, repo }: { owner: string; repo: string }) {
  const [permissions, setPermissions] = useState<Probe | null>(null);
  const [runnersState, setRunnersState] = useState<{ ok: boolean; runners: Runner[] } | null>(null);

  useEffect(() => {
    getWorkflowPermissions(owner, repo).then(setPermissions);
    listRunners(owner, repo).then((r) => setRunnersState({ ok: r.ok, runners: r.runners }));
  }, [owner, repo]);

  return (
    <div>
      <SectionTitle>Actions & Runners</SectionTitle>
      <StatusRow label="Workflow permissions" probe={permissions} />
      <div className="mt-4">
        <div className="mb-2 text-xs font-medium text-[var(--dh-text-secondary)]">Self-hosted runners</div>
        {!runnersState && <LoadingBlock label="runners" />}
        {runnersState && !runnersState.ok && (
          <EmptyBlock>Unavailable or missing scope for this token.</EmptyBlock>
        )}
        {runnersState && runnersState.ok && runnersState.runners.length === 0 && (
          <EmptyBlock>No self-hosted runners registered.</EmptyBlock>
        )}
        {runnersState?.ok && runnersState.runners.length > 0 && (
          <div className="space-y-1">
            {runnersState.runners.map((r) => (
              <div
                key={r.name}
                className="flex items-center gap-2 rounded-lg border border-[var(--dh-window-border)] bg-[var(--dh-surface-raised)] px-3 py-2"
              >
                <span
                  className={[
                    "h-2 w-2 shrink-0 rounded-full",
                    r.status === "online" ? "bg-emerald-400" : "bg-[var(--dh-window-border-active)]",
                  ].join(" ")}
                />
                <span className="min-w-0 flex-1 truncate text-sm text-[var(--dh-text)]">{r.name}</span>
                <span className="shrink-0 text-xs text-[var(--dh-text-secondary)]">
                  {r.os} · {r.busy ? "busy" : r.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      <p className="mt-3 text-xs text-[var(--dh-text-secondary)]">
        Workflow run history lives in the repository&apos;s Actions window; this
        category is administrative (permissions, runners) only.
      </p>
      <div className="mt-2">
        <ExternalLinkButton href={`https://github.com/${owner}/${repo}/settings/actions`} label="Manage Actions settings on GitHub" />
      </div>
    </div>
  );
}

// ---- Security ------------------------------------------------------------

function SecurityCategory({ owner, repo, branch }: { owner: string; repo: string; branch: string }) {
  const [probes, setProbes] = useState<Record<string, Probe | null>>({});

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const entries: [string, Promise<Probe>][] = [
        ["Branch protection", getBranchProtection(owner, repo, branch)],
        ["Dependabot alerts", getDependabot(owner, repo)],
        ["Code scanning", getCodeScanning(owner, repo)],
        ["Secret scanning", getSecretScanning(owner, repo)],
      ];
      for (const [label, p] of entries) {
        const result = await p.catch(() => ({ ok: false, status: 0, message: "Request failed" }));
        if (cancelled) return;
        setProbes((prev) => ({ ...prev, [label]: result }));
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [owner, repo, branch]);

  return (
    <div>
      <SectionTitle>Security</SectionTitle>
      <p className="mb-3 text-xs text-[var(--dh-text-secondary)]">
        Probes show what the current token can reach — a 403/404 usually means
        a missing scope or a feature disabled for this repository.
      </p>
      <div className="space-y-1.5">
        {["Branch protection", "Dependabot alerts", "Code scanning", "Secret scanning"].map((label) => (
          <StatusRow key={label} label={label} probe={probes[label] ?? null} />
        ))}
      </div>
      <div className="mt-2">
        <ExternalLinkButton href={`https://github.com/${owner}/${repo}/security`} label="Open Security overview on GitHub" />
      </div>
    </div>
  );
}

// ---- Secrets & Variables -----------------------------------------------

function SecretsCategory({ owner, repo }: { owner: string; repo: string }) {
  const [secretsState, setSecretsState] = useState<{ ok: boolean; secrets: SecretName[] } | null>(null);
  const [variablesState, setVariablesState] = useState<{ ok: boolean; variables: Variable[] } | null>(null);

  useEffect(() => {
    listSecretNames(owner, repo).then((r) => setSecretsState({ ok: r.ok, secrets: r.secrets }));
    listVariables(owner, repo).then((r) => setVariablesState({ ok: r.ok, variables: r.variables }));
  }, [owner, repo]);

  return (
    <div>
      <SectionTitle>Secrets & Variables</SectionTitle>
      <p className="mb-3 text-xs text-[var(--dh-text-secondary)]">
        Secret values are never returned by GitHub&apos;s API — only names and
        last-updated timestamps are shown. Values can be viewed and changed
        only on GitHub.
      </p>
      <div className="mb-2 text-xs font-medium text-[var(--dh-text-secondary)]">Secrets</div>
      {!secretsState && <LoadingBlock label="secrets" />}
      {secretsState && !secretsState.ok && <EmptyBlock>Unavailable or missing scope for this token.</EmptyBlock>}
      {secretsState?.ok && secretsState.secrets.length === 0 && <EmptyBlock>No Actions secrets configured.</EmptyBlock>}
      {secretsState?.ok && secretsState.secrets.length > 0 && (
        <div className="space-y-1">
          {secretsState.secrets.map((s) => (
            <Row key={s.name} label={s.name} value={`updated ${new Date(s.updatedAt).toLocaleDateString()}`} />
          ))}
        </div>
      )}
      <div className="mb-2 mt-4 text-xs font-medium text-[var(--dh-text-secondary)]">Variables</div>
      {!variablesState && <LoadingBlock label="variables" />}
      {variablesState && !variablesState.ok && <EmptyBlock>Unavailable or missing scope for this token.</EmptyBlock>}
      {variablesState?.ok && variablesState.variables.length === 0 && <EmptyBlock>No Actions variables configured.</EmptyBlock>}
      {variablesState?.ok && variablesState.variables.length > 0 && (
        <div className="space-y-1">
          {variablesState.variables.map((v) => (
            <Row key={v.name} label={v.name} value={v.value} />
          ))}
        </div>
      )}
      <div className="mt-4">
        <ExternalLinkButton href={`https://github.com/${owner}/${repo}/settings/secrets/actions`} label="Manage secrets & variables on GitHub" />
      </div>
    </div>
  );
}

// ---- Webhooks & Apps -----------------------------------------------------

function WebhooksCategory({ owner, repo }: { owner: string; repo: string }) {
  const [hooksState, setHooksState] = useState<{ ok: boolean; hooks: Webhook[] } | null>(null);

  useEffect(() => {
    listWebhooks(owner, repo).then((r) => setHooksState({ ok: r.ok, hooks: r.hooks }));
  }, [owner, repo]);

  return (
    <div>
      <SectionTitle>Webhooks & Apps</SectionTitle>
      <div className="mb-2 text-xs font-medium text-[var(--dh-text-secondary)]">Webhooks</div>
      {!hooksState && <LoadingBlock label="webhooks" />}
      {hooksState && !hooksState.ok && <EmptyBlock>Unavailable or missing scope for this token.</EmptyBlock>}
      {hooksState?.ok && hooksState.hooks.length === 0 && <EmptyBlock>No webhooks configured.</EmptyBlock>}
      {hooksState?.ok && hooksState.hooks.length > 0 && (
        <div className="space-y-1">
          {hooksState.hooks.map((h) => (
            <div key={h.id} className="rounded-lg border border-[var(--dh-window-border)] bg-[var(--dh-surface-raised)] px-3 py-2">
              <div className="flex items-center gap-2">
                <span
                  className={["h-2 w-2 shrink-0 rounded-full", h.active ? "bg-emerald-400" : "bg-[var(--dh-window-border-active)]"].join(" ")}
                />
                <span className="min-w-0 flex-1 truncate text-sm text-[var(--dh-text)]">{h.url}</span>
              </div>
              <div className="mt-1 text-xs text-[var(--dh-text-secondary)]">{h.events.join(", ")}</div>
            </div>
          ))}
        </div>
      )}
      <p className="mb-2 mt-4 text-xs text-[var(--dh-text-secondary)]">
        Installed GitHub Apps aren&apos;t exposed through a per-repository token
        endpoint — view and manage them on GitHub.
      </p>
      <ExternalLinkButton href={`https://github.com/${owner}/${repo}/settings/installations`} label="Manage installed Apps on GitHub" />
    </div>
  );
}

// ---- Pages & Deployments -------------------------------------------------

function PagesCategory({ owner, repo }: { owner: string; repo: string }) {
  const [pages, setPages] = useState<{ ok: boolean; url?: string; buildType?: string; source?: { branch: string; path: string } } | null>(null);

  useEffect(() => {
    getPagesInfo(owner, repo).then(setPages);
  }, [owner, repo]);

  return (
    <div>
      <SectionTitle>Pages & Deployments</SectionTitle>
      {!pages && <LoadingBlock label="Pages status" />}
      {pages && !pages.ok && <EmptyBlock>GitHub Pages is not enabled for this repository.</EmptyBlock>}
      {pages?.ok && (
        <div className="space-y-2">
          <Row label="Site URL" value={pages.url ?? "—"} />
          <Row label="Build type" value={pages.buildType ?? "—"} />
          {pages.source && <Row label="Source" value={`${pages.source.branch} · ${pages.source.path}`} />}
        </div>
      )}
      <div className="mt-4">
        <ExternalLinkButton href={`https://github.com/${owner}/${repo}/settings/pages`} label="Manage Pages on GitHub" />
      </div>
      <p className="mt-3 text-xs text-[var(--dh-text-secondary)]">
        Other deployment environments/history live under the repository&apos;s
        Actions and Environments settings on GitHub.
      </p>
    </div>
  );
}

// ---- Features --------------------------------------------------------

function FeaturesCategory({ owner, repo }: { owner: string; repo: string }) {
  const [details, setDetails] = useState<RepoDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDetails(null);
    setError(null);
    fetchRepoDetails(owner, repo)
      .then(setDetails)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load repository details"));
  }, [owner, repo]);

  return (
    <div>
      <SectionTitle>Features</SectionTitle>
      {error && <ErrorBlock message={error} />}
      {!details && !error && <LoadingBlock label="feature flags" />}
      {details && (
        <div className="space-y-1.5">
          <FeatureRow label="Issues" enabled={details.hasIssues} />
          <FeatureRow label="Projects" enabled={details.hasProjects} />
          <FeatureRow label="Wiki" enabled={details.hasWiki} />
          <FeatureRow label="Discussions" enabled={details.hasDiscussions} />
          <FeatureRow label="Downloads" enabled={details.hasDownloads} />
        </div>
      )}
      <p className="mt-3 text-xs text-[var(--dh-text-secondary)]">
        Toggling these features stays on GitHub.
      </p>
      <div className="mt-2">
        <ExternalLinkButton href={`https://github.com/${owner}/${repo}/settings`} label="Manage features on GitHub" />
      </div>
    </div>
  );
}

function FeatureRow({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-[var(--dh-window-border)] bg-[var(--dh-surface-raised)] px-3 py-2">
      <span className={["h-2 w-2 shrink-0 rounded-full", enabled ? "bg-emerald-400" : "bg-[var(--dh-window-border-active)]"].join(" ")} />
      <span className="flex-1 text-sm text-[var(--dh-text)]">{label}</span>
      <span className="text-xs text-[var(--dh-text-secondary)]">{enabled ? "Enabled" : "Disabled"}</span>
    </div>
  );
}

// ---- Danger Zone -------------------------------------------------------

function DangerZoneCategory({ owner, repo }: { owner: string; repo: string }) {
  const [details, setDetails] = useState<RepoDetails | null>(null);

  useEffect(() => {
    setDetails(null);
    fetchRepoDetails(owner, repo).then(setDetails).catch(() => setDetails(null));
  }, [owner, repo]);

  return (
    <div>
      <SectionTitle>Danger Zone</SectionTitle>
      {details && (
        <div className="mb-3 space-y-1.5">
          <Row label="Archived" value={details.archived ? "Yes" : "No"} />
          <Row label="Disabled" value={details.disabled ? "Yes" : "No"} />
          <Row label="Visibility" value={details.visibility} />
        </div>
      )}
      <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-3">
        <p className="mb-2 text-sm text-red-700 dark:text-red-300">
          Archiving, transferring, changing visibility or deleting this
          repository are not available in DRAGHUB — these are irreversible or
          high-impact operations with no documented DRAGHUB contract, so
          DRAGHUB never performs them on your behalf.
        </p>
        <ExternalLinkButton href={`https://github.com/${owner}/${repo}/settings#danger-zone`} label="Open the Danger Zone on GitHub" />
      </div>
    </div>
  );
}
