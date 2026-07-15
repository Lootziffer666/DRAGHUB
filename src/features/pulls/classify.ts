import type { CheckSummary, PullDetail, PullSummary } from "./api";

export type PrClass = "clean" | "conflict" | "failing" | "needs-review" | "spam-suspect";

/**
 * Deliberately simple v1 heuristic (PLAN.md M7: "ohne ML"). Without extra
 * per-PR API calls (account age isn't in the list/detail response) the
 * cheapest honest signal is diff size vs. description length; before the
 * lazy `PullDetail` fetch resolves, fall back to a much weaker title check.
 */
function isSpamSuspect(pr: PullSummary, detail?: PullDetail): boolean {
  const bodyLen = (pr.body ?? "").trim().length;
  if (detail) {
    const diffSize = detail.additions + detail.deletions;
    return bodyLen < 10 && diffSize > 300;
  }
  const genericTitle = /^(update|fix|test|readme|patch|changes?)\.?$/i.test(pr.title.trim());
  return bodyLen === 0 && (genericTitle || pr.title.trim().length < 8);
}

export function classifyPr(
  pr: PullSummary,
  detail?: PullDetail,
  checks?: CheckSummary
): PrClass {
  if (isSpamSuspect(pr, detail)) return "spam-suspect";
  if (detail && (detail.mergeable === false || detail.mergeableState === "dirty")) {
    return "conflict";
  }
  if (checks && checks.failing > 0) return "failing";
  if (!pr.draft && pr.requestedReviewers.length === 0 && pr.reviewDecision === null) {
    return "needs-review";
  }
  return "clean";
}
