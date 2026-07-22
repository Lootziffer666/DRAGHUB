import { describe, expect, test } from "bun:test";
import {
  hasUnresolvedConflicts,
  parseConflictHunks,
  resolveConflict,
  resolveConflictAt,
} from "./merge";

const TWO_HUNKS = [
  "line before",
  "<<<<<<< HEAD",
  "ours-1",
  "=======",
  "theirs-1",
  ">>>>>>> branch-a",
  "middle",
  "<<<<<<< HEAD",
  "ours-2",
  "=======",
  "theirs-2",
  ">>>>>>> branch-a",
  "line after",
].join("\n");

describe("parseConflictHunks", () => {
  test("finds every hunk in document order with distinct, stable ids", () => {
    const hunks = parseConflictHunks(TWO_HUNKS);
    expect(hunks).toHaveLength(2);
    expect(hunks[0].id).not.toBe(hunks[1].id);
    expect(hunks[0].ours).toEqual(["ours-1"]);
    expect(hunks[0].theirs).toEqual(["theirs-1"]);
    expect(hunks[1].ours).toEqual(["ours-2"]);
    expect(hunks[1].theirs).toEqual(["theirs-2"]);
  });

  test("clean content has no hunks", () => {
    expect(parseConflictHunks("just some text\nno markers here")).toHaveLength(0);
  });
});

describe("hasUnresolvedConflicts", () => {
  test("true while markers remain, false once they're gone", () => {
    expect(hasUnresolvedConflicts(TWO_HUNKS)).toBe(true);
    expect(hasUnresolvedConflicts("clean file")).toBe(false);
  });
});

describe("resolveConflictAt", () => {
  test("resolves exactly the targeted hunk and leaves the other untouched", () => {
    const hunks = parseConflictHunks(TWO_HUNKS);
    const next = resolveConflictAt(TWO_HUNKS, hunks[0].id, "theirs");

    // Hunk 1 resolved to its incoming side…
    expect(next).toContain("theirs-1");
    expect(next).not.toContain("ours-1");
    // …hunk 2 is still a literal, untouched conflict block.
    expect(next).toContain("<<<<<<<");
    expect(next).toContain("ours-2");
    expect(next).toContain("theirs-2");
    expect(hasUnresolvedConflicts(next)).toBe(true);
    expect(parseConflictHunks(next)).toHaveLength(1);
  });

  test("'both' concatenates ours then theirs for that hunk only", () => {
    const hunks = parseConflictHunks(TWO_HUNKS);
    const next = resolveConflictAt(TWO_HUNKS, hunks[1].id, "both");
    expect(next).toContain("ours-2\ntheirs-2");
    expect(parseConflictHunks(next)).toHaveLength(1);
  });

  test("a stale hunk id (already resolved, or from different content) is a no-op", () => {
    expect(resolveConflictAt(TWO_HUNKS, "not-a-real-id", "ours")).toBe(TWO_HUNKS);
  });

  test("resolving hunks one at a time converges to a clean file", () => {
    let content = TWO_HUNKS;
    for (const side of ["ours", "theirs"] as const) {
      const [next] = parseConflictHunks(content);
      content = resolveConflictAt(content, next.id, side);
    }
    expect(hasUnresolvedConflicts(content)).toBe(false);
    expect(content).toContain("ours-1");
    expect(content).toContain("theirs-2");
  });

  test("a manual edit that deletes markers is reflected on the next parse", () => {
    // Simulates the user hand-editing the Result panel instead of clicking
    // Accept — resolution is derived from live content, not stored state.
    const manuallyResolved = TWO_HUNKS.replace(
      /<<<<<<<[^\n]*\nours-1\n=======\ntheirs-1\n>>>>>>>[^\n]*/,
      "ours-1 and theirs-1, merged by hand",
    );
    expect(parseConflictHunks(manuallyResolved)).toHaveLength(1);
    expect(hasUnresolvedConflicts(manuallyResolved)).toBe(true);
  });
});

describe("resolveConflict (bulk)", () => {
  test("accept-all-ours resolves every hunk to its current side", () => {
    const hunks = parseConflictHunks(TWO_HUNKS);
    const choices = Object.fromEntries(hunks.map((h) => [h.id, "ours" as const]));
    const next = resolveConflict(TWO_HUNKS, choices);
    expect(hasUnresolvedConflicts(next)).toBe(false);
    expect(next).toContain("ours-1");
    expect(next).toContain("ours-2");
    expect(next).not.toContain("theirs-1");
    expect(next).not.toContain("theirs-2");
  });

  test("accept-all-theirs resolves every hunk to its incoming side", () => {
    const hunks = parseConflictHunks(TWO_HUNKS);
    const choices = Object.fromEntries(hunks.map((h) => [h.id, "theirs" as const]));
    const next = resolveConflict(TWO_HUNKS, choices);
    expect(hasUnresolvedConflicts(next)).toBe(false);
    expect(next).toContain("theirs-1");
    expect(next).toContain("theirs-2");
  });
});
