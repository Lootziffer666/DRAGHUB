import { describe, expect, test } from "bun:test";
import { reducer, initialState, type Tab } from "./store";
import type { RepoMeta } from "./github";

function meta(over: Partial<RepoMeta> = {}): RepoMeta {
  return {
    owner: "owner",
    repo: "alpha",
    fullName: "owner/alpha",
    branch: "main",
    defaultBranch: "main",
    description: null,
    stars: 0,
    forks: 0,
    language: null,
    private: false,
    htmlUrl: "https://github.com/owner/alpha",
    ...over,
  };
}

function fileTab(over: Partial<Tab> = {}): Tab {
  return {
    id: "tab-1",
    kind: "file",
    path: "README.md",
    label: "README.md",
    repoKey: "owner/alpha",
    branch: "main",
    entriesState: "idle",
    contentState: "idle",
    ...over,
  };
}

describe("historical ref tabs (M3 acceptance: branch off instead of blocking)", () => {
  test("a tab opened at a historical ref carries ref/refLabel", () => {
    let state = initialState;
    state = reducer(state, { type: "REPO_LOADED", meta: meta() });
    state = reducer(state, {
      type: "ADD_TAB",
      repoKey: "owner/alpha",
      activate: true,
      tab: fileTab({ ref: "abc1234", refLabel: "abc1234 · Jul 20, 2026" }),
    });
    const tab = state.repos["owner/alpha"].tabs[0];
    expect(tab.ref).toBe("abc1234");
    expect(tab.refLabel).toBe("abc1234 · Jul 20, 2026");
  });

  test("FILE_LOADED does not disturb a tab's ref pin", () => {
    let state = initialState;
    state = reducer(state, { type: "REPO_LOADED", meta: meta() });
    state = reducer(state, {
      type: "ADD_TAB",
      repoKey: "owner/alpha",
      activate: true,
      tab: fileTab({ ref: "abc1234", refLabel: "abc1234 · Jul 20, 2026" }),
    });
    state = reducer(state, {
      type: "FILE_LOADED",
      repoKey: "owner/alpha",
      id: "tab-1",
      content: "# Hello",
      size: 7,
      language: "Markdown",
    });
    const tab = state.repos["owner/alpha"].tabs[0];
    expect(tab.ref).toBe("abc1234");
    expect(tab.content).toBe("# Hello");
  });

  test("TAB_BRANCHED_OFF clears the ref pin and switches the tab to the new branch", () => {
    let state = initialState;
    state = reducer(state, { type: "REPO_LOADED", meta: meta() });
    state = reducer(state, {
      type: "ADD_TAB",
      repoKey: "owner/alpha",
      activate: true,
      tab: fileTab({ ref: "abc1234", refLabel: "abc1234 · Jul 20, 2026", content: "# Hello", contentState: "loaded" }),
    });
    state = reducer(state, {
      type: "TAB_BRANCHED_OFF",
      repoKey: "owner/alpha",
      id: "tab-1",
      branch: "variant/abc1234",
    });
    const tab = state.repos["owner/alpha"].tabs[0];
    expect(tab.ref).toBeUndefined();
    expect(tab.refLabel).toBeUndefined();
    expect(tab.branch).toBe("variant/abc1234");
    // Content stays intact — the new branch starts at the exact sha the
    // tab was pinned to, so no refetch is needed.
    expect(tab.content).toBe("# Hello");
  });

  test("TAB_BRANCHED_OFF for an unrelated tab id leaves other tabs untouched", () => {
    let state = initialState;
    state = reducer(state, { type: "REPO_LOADED", meta: meta() });
    state = reducer(state, {
      type: "ADD_TAB",
      repoKey: "owner/alpha",
      activate: true,
      tab: fileTab({ id: "tab-1", ref: "abc1234" }),
    });
    state = reducer(state, {
      type: "ADD_TAB",
      repoKey: "owner/alpha",
      activate: false,
      tab: fileTab({ id: "tab-2", path: "index.ts", ref: "def5678" }),
    });
    state = reducer(state, {
      type: "TAB_BRANCHED_OFF",
      repoKey: "owner/alpha",
      id: "tab-1",
      branch: "variant/abc1234",
    });
    const [t1, t2] = state.repos["owner/alpha"].tabs;
    expect(t1.ref).toBeUndefined();
    expect(t2.ref).toBe("def5678");
  });
});
