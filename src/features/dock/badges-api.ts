import { ghRequest } from "@/lib/github";

export type RepoBadge = {
  openPrs: number | null;
  openIssues: number | null;
  error?: string;
};

/**
 * One Search-API call per count (returns `total_count` directly) instead of
 * paging the list endpoints — the cheapest way to get "how many open PRs"
 * per pinned repo. Deliberately does NOT fetch per-PR mergeable/check-run
 * detail (that's M7's job for a single open repo) — doing that for every
 * pinned repo on a timer is exactly the rate-limit stampede PLAN.md §11
 * warns about, so the Dock only shows open counts, not a failing-CI count.
 */
export async function fetchRepoBadge(fullName: string): Promise<RepoBadge> {
  const [prRes, issueRes] = await Promise.all([
    ghRequest(`/search/issues?q=${encodeURIComponent(`repo:${fullName} is:pr is:open`)}`),
    ghRequest(`/search/issues?q=${encodeURIComponent(`repo:${fullName} is:issue is:open`)}`),
  ]);
  if (!prRes.ok || !issueRes.ok) {
    return {
      openPrs: null,
      openIssues: null,
      error: `Failed to load badge for ${fullName} (${prRes.status}/${issueRes.status}).`,
    };
  }
  const prData = await prRes.json<{ total_count: number }>();
  const issueData = await issueRes.json<{ total_count: number }>();
  return { openPrs: prData.total_count, openIssues: issueData.total_count };
}
