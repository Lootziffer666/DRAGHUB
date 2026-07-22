import { beforeEach, describe, expect, test } from "bun:test";

const backing = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => backing.get(k) ?? null,
  setItem: (k: string, v: string) => void backing.set(k, v),
  removeItem: (k: string) => void backing.delete(k),
  clear: () => backing.clear(),
};

import {
  categorySourceText,
  loadCategories,
  parseCategoryResponse,
} from "./categorize";
import { textHash } from "@/lib/ai";
import type { StarredRepo } from "./api";

beforeEach(() => {
  backing.clear();
});

function repo(over: Partial<StarredRepo>): StarredRepo {
  return {
    fullName: "octocat/Hello-World",
    owner: "octocat",
    repo: "Hello-World",
    description: "My first repository",
    stars: 10,
    language: "Ruby",
    private: false,
    htmlUrl: "x",
    updatedAt: "2026-01-01T00:00:00Z",
    ...over,
  };
}

describe("parseCategoryResponse", () => {
  test("parses a clean JSON object", () => {
    const text = '{"octocat/Hello-World": "Web Framework"}';
    expect(parseCategoryResponse(text)).toEqual({
      "octocat/Hello-World": "Web Framework",
    });
  });

  test("strips a markdown fence the model added despite instructions", () => {
    const text = '```json\n{"a/b": "CLI Tool"}\n```';
    expect(parseCategoryResponse(text)).toEqual({ "a/b": "CLI Tool" });
  });

  test("drops empty or non-string values instead of throwing", () => {
    const text = '{"a/b": "CLI Tool", "c/d": "", "e/f": 42}';
    expect(parseCategoryResponse(text)).toEqual({ "a/b": "CLI Tool" });
  });

  test("malformed JSON returns an empty object, not a throw", () => {
    expect(parseCategoryResponse("not json at all")).toEqual({});
  });
});

describe("category cache staleness", () => {
  test("a repo with no cached category is omitted, not defaulted", () => {
    expect(loadCategories([repo({})])).toEqual({});
  });

  test("categorySourceText changes when description or language changes", () => {
    const a = repo({ description: "one" });
    const b = repo({ description: "two" });
    expect(categorySourceText(a)).not.toBe(categorySourceText(b));
  });

  test("a cached category survives when the source text is unchanged", () => {
    const r = repo({});
    // Simulate what categorizeRepos would have written.
    localStorage.setItem(
      "draghub-starred-categories",
      JSON.stringify({
        [r.fullName]: {
          category: "Web Framework",
          sourceHash: textHash(categorySourceText(r)),
        },
      })
    );
    expect(loadCategories([r])).toEqual({ "octocat/Hello-World": "Web Framework" });
  });

  test("a cached category is dropped once the repo's description changes", () => {
    const original = repo({ description: "original" });
    localStorage.setItem(
      "draghub-starred-categories",
      JSON.stringify({
        [original.fullName]: {
          category: "Web Framework",
          sourceHash: textHash(categorySourceText(original)),
        },
      })
    );
    const changed = repo({ description: "a completely different project now" });
    expect(loadCategories([changed])).toEqual({});
  });
});
