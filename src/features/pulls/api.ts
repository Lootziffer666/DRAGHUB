import { ghRequest } from "@/lib/github";

export type PullSummary = {
  number: number;
  title: string;
  body: string | null;
  authorLogin: string;
  draft: boolean;
  headRef: string;
  baseRef: string;
  headSha: string;
  labels: string[];
  requestedReviewers: string[];
  reviewDecision: "approved" | "changes_requested" | "review_required" | null;
  createdAt: string;
  updatedAt: string;
  htmlUrl: string;
};

export type PullDetail = {
  mergeable: boolean | null;
  mergeableState: string;
  additions: number;
  deletions: number;
  changedFiles: number;
};

export type CheckSummary = {
  total: number;
  passing: number;
  failing: number;
  pending: number;
};

type RawPull = {
  number: number;
  title: string;
  body: string | null;
  user: { login: string } | null;
  draft: boolean;
  head: { ref: string; sha: string };
  base: { ref: string };
  labels: Array<{ name: string }>;
  requested_reviewers: Array<{ login: string }>;
  created_at: string;
  updated_at: string;
  html_url: string;
};

function mapPull(raw: RawPull): PullSummary {
  return {
    number: raw.number,
    title: raw.title,
    body: raw.body,
    authorLogin: raw.user?.login ?? "unknown",
    draft: raw.draft,
    headRef: raw.head.ref,
    headSha: raw.head.sha,
    baseRef: raw.base.ref,
    labels: raw.labels?.map((l) => l.name) ?? [],
    requestedReviewers: raw.requested_reviewers?.map((r) => r.login) ?? [],
    reviewDecision: null,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    htmlUrl: raw.html_url,
  };
}

export async function fetchPulls(owner: string, repo: string): Promise<PullSummary[]> {
  const res = await ghRequest(`/repos/${owner}/${repo}/pulls?state=open&per_page=100`);
  if (!res.ok) throw new Error(`Failed to load pull requests (${res.status}).`);
  const data = await res.json<RawPull[]>();
  return data.map(mapPull);
}

/** `mergeable` is computed asynchronously by GitHub and may be null on the
 * first check — callers should treat null as "unknown, try again shortly". */
export async function fetchPullDetail(
  owner: string,
  repo: string,
  number: number
): Promise<PullDetail> {
  const res = await ghRequest(`/repos/${owner}/${repo}/pulls/${number}`);
  if (!res.ok) throw new Error(`Failed to load PR #${number} (${res.status}).`);
  const data = await res.json<{
    mergeable: boolean | null;
    mergeable_state: string;
    additions: number;
    deletions: number;
    changed_files: number;
  }>();
  return {
    mergeable: data.mergeable,
    mergeableState: data.mergeable_state,
    additions: data.additions,
    deletions: data.deletions,
    changedFiles: data.changed_files,
  };
}

export async function fetchCheckSummary(
  owner: string,
  repo: string,
  ref: string
): Promise<CheckSummary> {
  const res = await ghRequest(`/repos/${owner}/${repo}/commits/${ref}/check-runs?per_page=100`);
  if (!res.ok) return { total: 0, passing: 0, failing: 0, pending: 0 };
  const data = await res.json<{
    check_runs: Array<{ status: string; conclusion: string | null }>;
  }>();
  let passing = 0;
  let failing = 0;
  let pending = 0;
  for (const run of data.check_runs) {
    if (run.status !== "completed") pending++;
    else if (run.conclusion === "success" || run.conclusion === "neutral" || run.conclusion === "skipped") passing++;
    else failing++;
  }
  return { total: data.check_runs.length, passing, failing, pending };
}

export type MergeMethod = "merge" | "squash" | "rebase";

export async function mergePull(
  owner: string,
  repo: string,
  number: number,
  method: MergeMethod = "merge"
): Promise<{ ok: boolean; error?: string }> {
  const res = await ghRequest(`/repos/${owner}/${repo}/pulls/${number}/merge`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ merge_method: method }),
  });
  if (res.ok) return { ok: true };
  const data = await res.json<{ message?: string }>().catch(() => ({}) as { message?: string });
  return { ok: false, error: data.message ?? `Merge failed (${res.status}).` };
}

export async function closePull(
  owner: string,
  repo: string,
  number: number
): Promise<{ ok: boolean; error?: string }> {
  const res = await ghRequest(`/repos/${owner}/${repo}/pulls/${number}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ state: "closed" }),
  });
  if (res.ok) return { ok: true };
  const data = await res.json<{ message?: string }>().catch(() => ({}) as { message?: string });
  return { ok: false, error: data.message ?? `Close failed (${res.status}).` };
}

export async function requestReviewers(
  owner: string,
  repo: string,
  number: number,
  reviewers: string[]
): Promise<{ ok: boolean; error?: string }> {
  const res = await ghRequest(`/repos/${owner}/${repo}/pulls/${number}/requested_reviewers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reviewers }),
  });
  if (res.ok) return { ok: true };
  const data = await res.json<{ message?: string }>().catch(() => ({}) as { message?: string });
  return { ok: false, error: data.message ?? `Requesting reviewers failed (${res.status}).` };
}

export async function addLabels(
  owner: string,
  repo: string,
  number: number,
  labels: string[]
): Promise<{ ok: boolean; error?: string }> {
  const res = await ghRequest(`/repos/${owner}/${repo}/issues/${number}/labels`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ labels }),
  });
  if (res.ok) return { ok: true };
  const data = await res.json<{ message?: string }>().catch(() => ({}) as { message?: string });
  return { ok: false, error: data.message ?? `Adding labels failed (${res.status}).` };
}

export async function deleteBranch(
  owner: string,
  repo: string,
  branch: string
): Promise<{ ok: boolean; error?: string }> {
  const res = await ghRequest(
    `/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(branch)}`,
    { method: "DELETE" }
  );
  if (res.ok) return { ok: true };
  const data = await res.json<{ message?: string }>().catch(() => ({}) as { message?: string });
  return { ok: false, error: data.message ?? `Deleting branch failed (${res.status}).` };
}
