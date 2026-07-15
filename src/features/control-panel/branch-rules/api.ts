import { ghRequest } from "@/lib/github";

export type BranchProtection = {
  requiredApprovingReviews: number | null;
  requiredStatusChecks: string[];
  strictStatusChecks: boolean;
  enforceAdmins: boolean;
  allowForcePushes: boolean;
  allowDeletions: boolean;
};

export type BranchProtectionResult =
  | { status: "protected"; data: BranchProtection }
  | { status: "unprotected" }
  | { status: "forbidden"; message: string }
  | { status: "error"; message: string };

/** Read-only view — PLAN.md M10 doesn't require an editing UI, and branch
 * protection has enough interdependent fields that a partial editor would
 * be more dangerous than useful in v1. */
export async function fetchBranchProtection(
  owner: string,
  repo: string,
  branch: string
): Promise<BranchProtectionResult> {
  const res = await ghRequest(`/repos/${owner}/${repo}/branches/${encodeURIComponent(branch)}/protection`);
  if (res.status === 404) return { status: "unprotected" };
  if (res.status === 403) {
    return { status: "forbidden", message: 'Token is missing "Administration: read" (or repo admin access).' };
  }
  if (!res.ok) return { status: "error", message: `Request failed (${res.status}).` };
  const data = await res.json<{
    required_pull_request_reviews?: { required_approving_review_count: number };
    required_status_checks?: { strict: boolean; contexts: string[] };
    enforce_admins?: { enabled: boolean };
    allow_force_pushes?: { enabled: boolean };
    allow_deletions?: { enabled: boolean };
  }>();
  return {
    status: "protected",
    data: {
      requiredApprovingReviews: data.required_pull_request_reviews?.required_approving_review_count ?? null,
      requiredStatusChecks: data.required_status_checks?.contexts ?? [],
      strictStatusChecks: data.required_status_checks?.strict ?? false,
      enforceAdmins: data.enforce_admins?.enabled ?? false,
      allowForcePushes: data.allow_force_pushes?.enabled ?? false,
      allowDeletions: data.allow_deletions?.enabled ?? false,
    },
  };
}
