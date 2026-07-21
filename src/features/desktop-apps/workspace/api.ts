import { ghRequest } from "@/lib/github";

/**
 * Data fetchers backing the Workspace Dashboard — the repository window's
 * default view (GITHUB_DESKTOP_SHELL redesign: task-oriented project state,
 * not a GitHub-website clone). Every call reuses the same authenticated
 * `ghRequest` path as the rest of the app; nothing here talks to GitHub
 * differently than the existing feature views.
 */

export type WorkflowRunSummary = {
  id: number;
  name: string | null;
  status: string;
  conclusion: string | null;
  htmlUrl: string;
  headBranch: string;
  updatedAt: string;
};

export async function fetchRecentWorkflowRuns(
  owner: string,
  repo: string,
  perPage = 6
): Promise<WorkflowRunSummary[]> {
  const res = await ghRequest(`/repos/${owner}/${repo}/actions/runs?per_page=${perPage}`);
  if (!res.ok) throw new Error(`Checks unavailable (${res.status}).`);
  const data = await res.json<{
    workflow_runs: Array<{
      id: number;
      name: string | null;
      status: string;
      conclusion: string | null;
      html_url: string;
      head_branch: string;
      updated_at: string;
    }>;
  }>();
  return (data.workflow_runs ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    status: r.status,
    conclusion: r.conclusion,
    htmlUrl: r.html_url,
    headBranch: r.head_branch,
    updatedAt: r.updated_at,
  }));
}

export type SecurityGlance = {
  dependabotOpen: boolean;
  codeScanningOpen: boolean;
  secretScanningOpen: boolean;
};

/** Cheap presence probes only — the Security feature view is where the
 * actual findings are read; the dashboard just needs "is there something
 * here worth looking at" to decide whether to surface it as a decision. */
export async function fetchSecurityGlance(owner: string, repo: string): Promise<SecurityGlance> {
  const probe = async (path: string): Promise<boolean> => {
    const res = await ghRequest(path);
    if (!res.ok) return false;
    const data = await res.json<unknown[]>().catch(() => []);
    return Array.isArray(data) && data.length > 0;
  };
  const [dependabotOpen, codeScanningOpen, secretScanningOpen] = await Promise.all([
    probe(`/repos/${owner}/${repo}/dependabot/alerts?state=open&per_page=1`),
    probe(`/repos/${owner}/${repo}/code-scanning/alerts?state=open&per_page=1`),
    probe(`/repos/${owner}/${repo}/secret-scanning/alerts?state=open&per_page=1`),
  ]);
  return { dependabotOpen, codeScanningOpen, secretScanningOpen };
}
