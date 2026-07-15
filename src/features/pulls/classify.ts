import type { PullRequestSummary } from "./api";
export type PrClass = "clean" | "conflict" | "failing" | "needs-review" | "spam-suspect";
export function classifyPr(pr: PullRequestSummary): PrClass {
  if (pr.mergeable === false) return "conflict";
  if (pr.labels.some((l) => /fail|ci|broken/i.test(l))) return "failing";
  if (pr.draft || pr.labels.some((l) => /review|needs/i.test(l))) return "needs-review";
  if (pr.changedFiles > 50 && pr.bodyLength < 80) return "spam-suspect";
  return "clean";
}
