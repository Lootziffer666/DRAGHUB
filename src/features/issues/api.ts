import { ghRequest } from "@/lib/github";

export type IssueSummary = {
  number: number;
  title: string;
  body: string | null;
  authorLogin: string;
  labels: string[];
  commentsCount: number;
  createdAt: string;
  updatedAt: string;
  htmlUrl: string;
};

type RawIssue = {
  number: number;
  title: string;
  body: string | null;
  user: { login: string } | null;
  labels: Array<{ name: string } | string>;
  comments: number;
  created_at: string;
  updated_at: string;
  html_url: string;
  pull_request?: unknown;
};

function mapIssue(raw: RawIssue): IssueSummary {
  return {
    number: raw.number,
    title: raw.title,
    body: raw.body,
    authorLogin: raw.user?.login ?? "unknown",
    labels: raw.labels.map((l) => (typeof l === "string" ? l : l.name)),
    commentsCount: raw.comments,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    htmlUrl: raw.html_url,
  };
}

/** The Issues API also returns PRs (they share numbering) — filter those out. */
export async function fetchIssues(owner: string, repo: string): Promise<IssueSummary[]> {
  const res = await ghRequest(`/repos/${owner}/${repo}/issues?state=open&per_page=100`);
  if (!res.ok) throw new Error(`Failed to load issues (${res.status}).`);
  const data = await res.json<RawIssue[]>();
  return data.filter((i) => !i.pull_request).map(mapIssue);
}

export async function closeIssue(
  owner: string,
  repo: string,
  number: number
): Promise<{ ok: boolean; error?: string }> {
  const res = await ghRequest(`/repos/${owner}/${repo}/issues/${number}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ state: "closed" }),
  });
  if (res.ok) return { ok: true };
  const data = await res.json<{ message?: string }>().catch(() => ({}) as { message?: string });
  return { ok: false, error: data.message ?? `Close failed (${res.status}).` };
}

export async function addIssueLabels(
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
