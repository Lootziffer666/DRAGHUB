import { describe, expect, test } from "bun:test";
import type { TreeEntry } from "@/lib/github";
import type { Vitality } from "@/lib/vitality";
import { buildWorldModel } from "./world-model";

function blob(path: string, size?: number): TreeEntry {
  return { path, mode: "100644", type: "blob", sha: "sha", size };
}

function tree(path: string): TreeEntry {
  return { path, mode: "040000", type: "tree", sha: "sha" };
}

describe("buildWorldModel", () => {
  test("one top-level blob becomes one building with the same path", () => {
    const model = buildWorldModel([blob("README.md", 10)], new Map());
    expect(model.buildings).toHaveLength(1);
    expect(model.buildings[0]?.path).toBe("README.md");
  });

  test("nested entries are excluded (depth-1 only)", () => {
    const model = buildWorldModel(
      [blob("README.md", 10), blob("src/index.ts", 10)],
      new Map()
    );
    expect(model.buildings.map((b) => b.path)).toEqual(["README.md"]);
  });

  test("tree entries are excluded — buildings only come from blobs", () => {
    const model = buildWorldModel([blob("README.md", 10), tree("src")], new Map());
    expect(model.buildings.map((b) => b.path)).toEqual(["README.md"]);
  });

  test("different extensions map to different archetypes", () => {
    const model = buildWorldModel(
      [blob("main.ts", 10), blob("README.md", 10)],
      new Map()
    );
    const byPath = Object.fromEntries(model.buildings.map((b) => [b.path, b.archetype]));
    expect(byPath["main.ts"]).not.toBe(byPath["README.md"]);
  });

  test("a larger file produces a taller building than a smaller one", () => {
    const model = buildWorldModel(
      [blob("big.ts", 100_000), blob("small.ts", 10)],
      new Map()
    );
    const byPath = Object.fromEntries(model.buildings.map((b) => [b.path, b.heightUnits]));
    expect(byPath["big.ts"]!).toBeGreaterThan(byPath["small.ts"]!);
  });

  test("a path present in the vitality map gets that level; an absent path gets 'unknown'", () => {
    const vitality: Vitality = { lastCommitAt: "2026-01-01", ageDays: 1, level: "fresh" };
    const model = buildWorldModel(
      [blob("known.ts", 10), blob("unknown.ts", 10)],
      new Map([["known.ts", vitality]])
    );
    const byPath = Object.fromEntries(model.buildings.map((b) => [b.path, b.vitalityLevel]));
    expect(byPath["known.ts"]).toBe("fresh");
    expect(byPath["unknown.ts"]).toBe("unknown");
  });
});
