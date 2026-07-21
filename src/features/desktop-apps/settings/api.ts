import { ghRequest } from "@/lib/github";
import { probe } from "@/features/control-panel/api";
export {
  probe,
  getBranchProtection,
  getDependabot,
  getCodeScanning,
  getSecretScanning,
  codeownersTemplate,
} from "@/features/control-panel/api";

export type Probe = { ok: boolean; status: number; message: string };

/**
 * Additional GitHub API calls backing the repository Settings control
 * panel's ten categories (docs/GITHUB_DESKTOP_SHELL_SPEC.md §8.10). Every
 * call follows the same scope-safety rule as `probe()` in
 * features/control-panel/api.ts: a missing token scope is detected via a
 * live request and reported as a visible status, never by inspecting the
 * token itself (PATs aren't self-describing) and never by failing silently.
 */

export type RepoDetails = {
  description: string | null;
  homepage: string | null;
  topics: string[];
  visibility: string;
  defaultBranch: string;
  createdAt: string;
  updatedAt: string;
  pushedAt: string;
  openIssuesCount: number;
  archived: boolean;
  disabled: boolean;
  hasIssues: boolean;
  hasProjects: boolean;
  hasWiki: boolean;
  hasDiscussions: boolean;
  hasDownloads: boolean;
  license: string | null;
};

export async function fetchRepoDetails(owner: string, repo: string): Promise<RepoDetails> {
  const res = await ghRequest(`/repos/${owner}/${repo}`);
  if (!res.ok) throw new Error(`Repository details unavailable (${res.status}).`);
  const d = await res.json<{
    description: string | null;
    homepage: string | null;
    topics?: string[];
    visibility?: string;
    private: boolean;
    default_branch: string;
    created_at: string;
    updated_at: string;
    pushed_at: string;
    open_issues_count: number;
    archived: boolean;
    disabled: boolean;
    has_issues: boolean;
    has_projects: boolean;
    has_wiki: boolean;
    has_discussions: boolean;
    has_downloads: boolean;
    license: { name: string } | null;
  }>();
  return {
    description: d.description,
    homepage: d.homepage,
    topics: d.topics ?? [],
    visibility: d.visibility ?? (d.private ? "private" : "public"),
    defaultBranch: d.default_branch,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
    pushedAt: d.pushed_at,
    openIssuesCount: d.open_issues_count,
    archived: d.archived,
    disabled: d.disabled,
    hasIssues: d.has_issues,
    hasProjects: d.has_projects,
    hasWiki: d.has_wiki,
    hasDiscussions: d.has_discussions,
    hasDownloads: d.has_downloads,
    license: d.license?.name ?? null,
  };
}

export type Collaborator = {
  login: string;
  avatarUrl: string;
  htmlUrl: string;
  permission: string;
};

export async function listCollaborators(owner: string, repo: string): Promise<Collaborator[]> {
  const res = await ghRequest(`/repos/${owner}/${repo}/collaborators?per_page=30`);
  if (!res.ok) throw new Error(`Collaborators unavailable (${res.status}).`);
  const data = await res.json<
    Array<{
      login: string;
      avatar_url: string;
      html_url: string;
      role_name?: string;
      permissions?: { admin?: boolean; maintain?: boolean; push?: boolean; triage?: boolean };
    }>
  >();
  return data.map((c) => ({
    login: c.login,
    avatarUrl: c.avatar_url,
    htmlUrl: c.html_url,
    permission:
      c.role_name ??
      (c.permissions?.admin
        ? "admin"
        : c.permissions?.maintain
          ? "maintain"
          : c.permissions?.push
            ? "write"
            : c.permissions?.triage
              ? "triage"
              : "read"),
  }));
}

export type BranchSummary = { name: string; protected: boolean };

export async function listBranches(owner: string, repo: string): Promise<BranchSummary[]> {
  const res = await ghRequest(`/repos/${owner}/${repo}/branches?per_page=30`);
  if (!res.ok) throw new Error(`Branches unavailable (${res.status}).`);
  const data = await res.json<Array<{ name: string; protected: boolean }>>();
  return data.map((b) => ({ name: b.name, protected: b.protected }));
}

export function getRulesets(owner: string, repo: string) {
  return probe(`/repos/${owner}/${repo}/rulesets`);
}

export function getWorkflowPermissions(owner: string, repo: string) {
  return probe(`/repos/${owner}/${repo}/actions/permissions`);
}

export type Runner = { name: string; status: string; busy: boolean; os: string };

export async function listRunners(
  owner: string,
  repo: string
): Promise<{ ok: boolean; status: number; runners: Runner[] }> {
  const res = await ghRequest(`/repos/${owner}/${repo}/actions/runners`);
  if (!res.ok) return { ok: false, status: res.status, runners: [] };
  const data = await res.json<{
    runners: Array<{ name: string; status: string; busy: boolean; os: string }>;
  }>();
  return { ok: true, status: res.status, runners: data.runners ?? [] };
}

export type SecretName = { name: string; updatedAt: string };

/** GitHub's Actions Secrets API only ever returns names, never values — this
 * is a hard API guarantee, not a client-side redaction we're responsible
 * for maintaining. */
export async function listSecretNames(
  owner: string,
  repo: string
): Promise<{ ok: boolean; status: number; secrets: SecretName[] }> {
  const res = await ghRequest(`/repos/${owner}/${repo}/actions/secrets?per_page=30`);
  if (!res.ok) return { ok: false, status: res.status, secrets: [] };
  const data = await res.json<{ secrets: Array<{ name: string; updated_at: string }> }>();
  return {
    ok: true,
    status: res.status,
    secrets: data.secrets.map((s) => ({ name: s.name, updatedAt: s.updated_at })),
  };
}

export type Variable = { name: string; value: string; updatedAt: string };

export async function listVariables(
  owner: string,
  repo: string
): Promise<{ ok: boolean; status: number; variables: Variable[] }> {
  const res = await ghRequest(`/repos/${owner}/${repo}/actions/variables?per_page=30`);
  if (!res.ok) return { ok: false, status: res.status, variables: [] };
  const data = await res.json<{
    variables: Array<{ name: string; value: string; updated_at: string }>;
  }>();
  return {
    ok: true,
    status: res.status,
    variables: data.variables.map((v) => ({ name: v.name, value: v.value, updatedAt: v.updated_at })),
  };
}

export type Webhook = { id: number; url: string; active: boolean; events: string[] };

export async function listWebhooks(
  owner: string,
  repo: string
): Promise<{ ok: boolean; status: number; hooks: Webhook[] }> {
  const res = await ghRequest(`/repos/${owner}/${repo}/hooks?per_page=30`);
  if (!res.ok) return { ok: false, status: res.status, hooks: [] };
  const data = await res.json<
    Array<{ id: number; config: { url?: string }; active: boolean; events: string[] }>
  >();
  return {
    ok: true,
    status: res.status,
    hooks: data.map((h) => ({ id: h.id, url: h.config.url ?? "(url hidden)", active: h.active, events: h.events })),
  };
}

export async function getPagesInfo(
  owner: string,
  repo: string
): Promise<{
  ok: boolean;
  status: number;
  url?: string;
  buildType?: string;
  source?: { branch: string; path: string };
}> {
  const res = await ghRequest(`/repos/${owner}/${repo}/pages`);
  if (!res.ok) return { ok: false, status: res.status };
  const data = await res.json<{
    html_url?: string;
    url?: string;
    build_type?: string;
    source?: { branch: string; path: string };
  }>();
  return { ok: true, status: res.status, url: data.html_url ?? data.url, buildType: data.build_type, source: data.source };
}
