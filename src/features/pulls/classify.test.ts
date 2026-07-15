import { describe, test, expect } from "bun:test";
import { classifyPr } from "./classify";
import type { PullSummary } from "./api";

function basePr(overrides: Partial<PullSummary> = {}): PullSummary {
  return {
    number: 1,
    title: "Add dark mode toggle to settings",
    body: "This adds a dark mode toggle and persists the preference in localStorage.",
    authorLogin: "octocat",
    draft: false,
    headRef: "feature/dark-mode",
    baseRef: "main",
    headSha: "abc123",
    labels: [],
    requestedReviewers: ["reviewer1"],
    reviewDecision: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-02T00:00:00Z",
    htmlUrl: "https://github.com/o/r/pull/1",
    ...overrides,
  };
}

describe("classifyPr", () => {
  test("a normal PR with a reviewer requested is clean", () => {
    expect(classifyPr(basePr())).toBe("clean");
  });

  test("no requested reviewers and no review decision needs review", () => {
    expect(classifyPr(basePr({ requestedReviewers: [] }))).toBe("needs-review");
  });

  test("draft PRs are not flagged as needing review", () => {
    expect(classifyPr(basePr({ requestedReviewers: [], draft: true }))).toBe("clean");
  });

  test("mergeable: false is a conflict", () => {
    const pr = basePr();
    expect(
      classifyPr(pr, { mergeable: false, mergeableState: "dirty", additions: 5, deletions: 2, changedFiles: 1 })
    ).toBe("conflict");
  });

  test("failing checks take priority over needs-review", () => {
    const pr = basePr({ requestedReviewers: [] });
    expect(classifyPr(pr, undefined, { total: 3, passing: 1, failing: 1, pending: 1 })).toBe("failing");
  });

  test("large diff with no description is spam-suspect", () => {
    const pr = basePr({ body: "" });
    expect(
      classifyPr(pr, { mergeable: true, mergeableState: "clean", additions: 400, deletions: 50, changedFiles: 10 })
    ).toBe("spam-suspect");
  });

  test("generic one-word title with empty body is spam-suspect before detail loads", () => {
    expect(classifyPr(basePr({ title: "fix", body: "" }))).toBe("spam-suspect");
  });

  test("a well-described PR with a large diff is not spam-suspect", () => {
    const pr = basePr({ body: "Refactors the auth module to use the new session API." });
    expect(
      classifyPr(pr, { mergeable: true, mergeableState: "clean", additions: 500, deletions: 100, changedFiles: 20 })
    ).toBe("clean");
  });
});
