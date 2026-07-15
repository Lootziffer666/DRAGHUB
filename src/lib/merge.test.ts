import { describe, test, expect } from "bun:test";
import { mergeThreeWay, applyResolutions, joinLines } from "./merge";

function lines(...ls: string[]): string {
  return joinLines(ls);
}

describe("mergeThreeWay", () => {
  test("identical on all sides merges cleanly", () => {
    const text = lines("a", "b", "c");
    const result = mergeThreeWay(text, text, text);
    expect(result.hasConflict).toBe(false);
    expect(applyResolutions(result.hunks, [])).toBe(text);
  });

  test("only ours changed a line", () => {
    const base = lines("a", "b", "c");
    const ours = lines("a", "X", "c");
    const theirs = lines("a", "b", "c");
    const result = mergeThreeWay(base, ours, theirs);
    expect(result.hasConflict).toBe(false);
    expect(applyResolutions(result.hunks, [])).toBe(ours);
  });

  test("only theirs changed a line", () => {
    const base = lines("a", "b", "c");
    const ours = lines("a", "b", "c");
    const theirs = lines("a", "Y", "c");
    const result = mergeThreeWay(base, ours, theirs);
    expect(result.hasConflict).toBe(false);
    expect(applyResolutions(result.hunks, [])).toBe(theirs);
  });

  test("both sides make the identical edit — no conflict", () => {
    const base = lines("a", "b", "c");
    const ours = lines("a", "same-edit", "c");
    const theirs = lines("a", "same-edit", "c");
    const result = mergeThreeWay(base, ours, theirs);
    expect(result.hasConflict).toBe(false);
    expect(applyResolutions(result.hunks, [])).toBe(ours);
  });

  test("both sides edit the same line differently — conflict", () => {
    const base = lines("a", "b", "c");
    const ours = lines("a", "ours-value", "c");
    const theirs = lines("a", "theirs-value", "c");
    const result = mergeThreeWay(base, ours, theirs);
    expect(result.hasConflict).toBe(true);
    const conflict = result.hunks.find((h) => h.kind === "conflict");
    expect(conflict).toBeDefined();
    if (conflict?.kind === "conflict") {
      expect(conflict.baseLines).toEqual(["b"]);
      expect(conflict.oursLines).toEqual(["ours-value"]);
      expect(conflict.theirsLines).toEqual(["theirs-value"]);
    }
  });

  test("disjoint edits on both sides both apply without conflict", () => {
    const base = lines("a", "b", "c", "d", "e");
    const ours = lines("A", "b", "c", "d", "e");
    const theirs = lines("a", "b", "c", "d", "E");
    const result = mergeThreeWay(base, ours, theirs);
    expect(result.hasConflict).toBe(false);
    expect(applyResolutions(result.hunks, [])).toBe(lines("A", "b", "c", "d", "E"));
  });

  test("one side deletes a line the other left untouched", () => {
    const base = lines("a", "b", "c");
    const ours = lines("a", "c");
    const theirs = lines("a", "b", "c");
    const result = mergeThreeWay(base, ours, theirs);
    expect(result.hasConflict).toBe(false);
    expect(applyResolutions(result.hunks, [])).toBe(ours);
  });

  test("insertions in different parts of the file both apply", () => {
    const base = lines("a", "b", "c");
    const ours = lines("NEW-TOP", "a", "b", "c");
    const theirs = lines("a", "b", "c", "NEW-BOTTOM");
    const result = mergeThreeWay(base, ours, theirs);
    expect(result.hasConflict).toBe(false);
    expect(applyResolutions(result.hunks, [])).toBe(
      lines("NEW-TOP", "a", "b", "c", "NEW-BOTTOM")
    );
  });

  test("conflict resolution: ours / theirs / both", () => {
    const base = lines("a", "b", "c");
    const ours = lines("a", "ours-value", "c");
    const theirs = lines("a", "theirs-value", "c");
    const result = mergeThreeWay(base, ours, theirs);
    expect(applyResolutions(result.hunks, ["ours"])).toBe(ours);
    expect(applyResolutions(result.hunks, ["theirs"])).toBe(theirs);
    expect(applyResolutions(result.hunks, ["both"])).toBe(
      lines("a", "ours-value", "theirs-value", "c")
    );
  });

  test("empty base: both sides add identical content", () => {
    const result = mergeThreeWay("", "hello", "hello");
    expect(result.hasConflict).toBe(false);
    expect(applyResolutions(result.hunks, [])).toBe("hello");
  });

  test("empty base: one side empty, other added content", () => {
    const result = mergeThreeWay("", "", "new content");
    expect(result.hasConflict).toBe(false);
    expect(applyResolutions(result.hunks, [])).toBe("new content");
  });

  test("empty base: both sides add different content — conflict", () => {
    const result = mergeThreeWay("", "ours content", "theirs content");
    expect(result.hasConflict).toBe(true);
  });

  test("insertion in the middle of an otherwise-untouched region does not conflict", () => {
    const base = lines("a", "b", "c", "d", "e");
    const ours = lines("a", "b", "INSERTED", "c", "d", "e");
    const theirs = lines("a", "b", "c", "d", "e");
    const result = mergeThreeWay(base, ours, theirs);
    expect(result.hasConflict).toBe(false);
    expect(applyResolutions(result.hunks, [])).toBe(ours);
  });

  test("both sides insert identical content at the same point", () => {
    const base = lines("a", "b", "c");
    const ours = lines("a", "SAME", "b", "c");
    const theirs = lines("a", "SAME", "b", "c");
    const result = mergeThreeWay(base, ours, theirs);
    expect(result.hasConflict).toBe(false);
    expect(applyResolutions(result.hunks, [])).toBe(ours);
  });

  test("both sides insert different content at the same point — conflict", () => {
    const base = lines("a", "b", "c");
    const ours = lines("a", "OURS-INSERT", "b", "c");
    const theirs = lines("a", "THEIRS-INSERT", "b", "c");
    const result = mergeThreeWay(base, ours, theirs);
    expect(result.hasConflict).toBe(true);
  });

  test("multiple independent conflicts resolve by encounter order", () => {
    const base = lines("a", "b", "c", "d", "e");
    const ours = lines("OURS1", "b", "c", "OURS2", "e");
    const theirs = lines("THEIRS1", "b", "c", "THEIRS2", "e");
    const result = mergeThreeWay(base, ours, theirs);
    const conflicts = result.hunks.filter((h) => h.kind === "conflict");
    expect(conflicts).toHaveLength(2);
    expect(applyResolutions(result.hunks, ["ours", "theirs"])).toBe(
      lines("OURS1", "b", "c", "THEIRS2", "e")
    );
  });
});
