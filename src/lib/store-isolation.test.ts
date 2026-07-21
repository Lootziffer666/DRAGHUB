import { describe, expect, test } from "bun:test";
import { reducer, initialState } from "./store";
import type { RepoMeta } from "./github";

function meta(over: Partial<RepoMeta>): RepoMeta {
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

describe("per-repo loading and error isolation", () => {
  test("loading one repo does not affect another repo's request state", () => {
    let state = initialState;
    state = reducer(state, { type: "REPO_LOADING_FOR", repoKey: "owner/alpha" });
    state = reducer(state, {
      type: "REPO_ERROR_FOR",
      repoKey: "owner/beta",
      error: "boom",
    });
    expect(state.repoRequests["owner/alpha"]).toEqual({ loading: true, error: null });
    expect(state.repoRequests["owner/beta"]).toEqual({ loading: false, error: "boom" });
  });

  test("retry affects only the retried repo", () => {
    let state = initialState;
    state = reducer(state, {
      type: "REPO_ERROR_FOR",
      repoKey: "owner/alpha",
      error: "network down",
    });
    state = reducer(state, {
      type: "REPO_ERROR_FOR",
      repoKey: "owner/beta",
      error: "network down",
    });
    // Retry alpha only.
    state = reducer(state, { type: "REPO_LOADING_FOR", repoKey: "owner/alpha" });
    state = reducer(state, { type: "REPO_LOADED", meta: meta({}) });

    expect(state.repoRequests["owner/alpha"]).toEqual({ loading: false, error: null });
    // Beta's error is untouched by alpha's retry.
    expect(state.repoRequests["owner/beta"]).toEqual({ loading: false, error: "network down" });
  });

  test("concurrent openRepo-style hydration for two repos stays isolated", () => {
    let state = initialState;
    state = reducer(state, { type: "REPO_LOADING_FOR", repoKey: "owner/alpha" });
    state = reducer(state, { type: "REPO_LOADING_FOR", repoKey: "owner/beta" });
    expect(state.repoRequests["owner/alpha"].loading).toBe(true);
    expect(state.repoRequests["owner/beta"].loading).toBe(true);

    state = reducer(state, { type: "REPO_LOADED", meta: meta({ fullName: "owner/alpha" }) });
    expect(state.repoRequests["owner/alpha"]).toEqual({ loading: false, error: null });
    // Beta is still mid-flight, unaffected by alpha resolving.
    expect(state.repoRequests["owner/beta"]).toEqual({ loading: true, error: null });

    state = reducer(state, {
      type: "REPO_ERROR_FOR",
      repoKey: "owner/beta",
      error: "rate limited",
    });
    expect(state.repoRequests["owner/beta"]).toEqual({ loading: false, error: "rate limited" });
    expect(state.repoRequests["owner/alpha"]).toEqual({ loading: false, error: null });
  });

  test("REPO_LOADED reconciles requested vs canonical repoKey casing", () => {
    let state = initialState;
    // A hand-typed request may differ in case from the API's canonical fullName.
    state = reducer(state, { type: "REPO_LOADING_FOR", repoKey: "owner/alpha" });
    state = reducer(state, {
      type: "REPO_LOADED",
      meta: meta({ fullName: "Owner/Alpha" }),
    });
    // The lowercased request key resolves to the loaded (canonical-cased) repo.
    expect(state.repoRequests["owner/alpha"]).toEqual({ loading: false, error: null });
    expect(state.repos["Owner/Alpha"]).toBeDefined();
  });

  test("RELEASE_REPO removes only that repository's request state", () => {
    let state = initialState;
    state = reducer(state, { type: "REPO_LOADED", meta: meta({ fullName: "owner/alpha" }) });
    state = reducer(state, { type: "REPO_LOADED", meta: meta({ fullName: "owner/beta" }) });
    state = reducer(state, {
      type: "REPO_ERROR_FOR",
      repoKey: "owner/beta",
      error: "boom",
    });

    state = reducer(state, { type: "RELEASE_REPO", repoKey: "owner/alpha" });

    expect(state.repos["owner/alpha"]).toBeUndefined();
    expect(state.repoRequests["owner/alpha"]).toBeUndefined();
    // Beta's repo and request state survive alpha's release.
    expect(state.repos["owner/beta"]).toBeDefined();
    expect(state.repoRequests["owner/beta"]).toEqual({ loading: false, error: "boom" });
  });

  test("CLOSE_REPO clears only the focused-repo pointer, not request state", () => {
    let state = initialState;
    state = reducer(state, {
      type: "REPO_ERROR_FOR",
      repoKey: "owner/alpha",
      error: "boom",
    });
    state = reducer(state, { type: "CLOSE_REPO" });
    expect(state.activeRepoKey).toBeNull();
    expect(state.repoRequests["owner/alpha"]).toEqual({ loading: false, error: "boom" });
  });
});
