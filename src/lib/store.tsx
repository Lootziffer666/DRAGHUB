"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import {
  fetchContents,
  fetchFileContent,
  fetchRepoMeta,
  parseRepoInput,
  type GithubEntry,
  type RepoMeta,
} from "./github";
import type { ViewMode } from "./layout";

export type Tab = {
  id: string;
  kind: "dir" | "file";
  path: string;
  label: string;
  repoKey: string;
  branch: string;
  entries?: GithubEntry[];
  entriesState: "idle" | "loading" | "loaded" | "error";
  entriesError?: string;
  content?: string;
  contentState: "idle" | "loading" | "loaded" | "error";
  contentError?: string;
  language?: string;
  size?: number;
};

export type RepoState = {
  meta: RepoMeta;
  tabs: Tab[];
  activeTabId: string | null;
  treeCache: Record<string, GithubEntry[]>;
  treeState: Record<string, "loading" | "loaded" | "error">;
  expanded: Record<string, boolean>;
  selection: string[];
  viewMode: ViewMode;
};

type RepoRequest = { loading: boolean; error: string | null };

type State = {
  repos: Record<string, RepoState>;
  activeRepoKey: string | null;
  pinnedRepoKeys: string[];
  recent: string[];
  // Per-repository hydration status keyed by a LOWERCASED repoKey, so
  // "Owner/Repo" and "owner/repo" resolve to the same entry. This isolates
  // each repository window's loading/error state (Alpha can load while Beta
  // shows an error) instead of leaking a single global flag everywhere.
  repoRequests: Record<string, RepoRequest>;
};

// Every repository-scoped action carries its target repoKey explicitly, so
// two repository windows can mutate their own workspace concurrently without
// racing over a single "active" pointer (MULTI_REPO_WINDOW_DOCK_SPEC §7).
type Action =
  | { type: "REPO_LOADING_FOR"; repoKey: string }
  | { type: "REPO_LOADED"; meta: RepoMeta }
  | { type: "REPO_ERROR_FOR"; repoKey: string; error: string }
  | { type: "CLOSE_REPO" }
  | { type: "RELEASE_REPO"; repoKey: string }
  | { type: "SWITCH_REPO"; repoKey: string }
  | { type: "TOGGLE_PIN_REPO"; repoKey: string }
  | { type: "ADD_TAB"; repoKey: string; tab: Tab; activate: boolean }
  | { type: "CLOSE_TAB"; repoKey: string; id: string }
  | { type: "SET_ACTIVE"; repoKey: string; id: string }
  | { type: "MOVE_TAB"; repoKey: string; from: number; to: number }
  | { type: "DIR_LOADING"; repoKey: string; path: string }
  | { type: "DIR_LOADED"; repoKey: string; path: string; entries: GithubEntry[] }
  | { type: "DIR_ERROR"; repoKey: string; path: string }
  | { type: "DIR_INVALIDATE"; repoKey: string; path: string }
  | { type: "DIR_ATTACH"; repoKey: string; id: string; entries: GithubEntry[] }
  | { type: "FILE_LOADING"; repoKey: string; id: string }
  | { type: "FILE_LOADED"; repoKey: string; id: string; content: string; language: string; size: number }
  | { type: "FILE_ERROR"; repoKey: string; id: string; error: string }
  | { type: "SET_EXPANDED"; repoKey: string; path: string; value: boolean }
  | { type: "SET_SELECTION"; repoKey: string; paths: string[] }
  | { type: "SET_BRANCH"; repoKey: string; branch: string }
  | { type: "SET_VIEW_MODE"; repoKey: string; viewMode: ViewMode };

function emptyRepo(meta: RepoMeta): RepoState {
  return {
    meta,
    tabs: [],
    activeTabId: null,
    treeCache: {},
    treeState: {},
    expanded: { "": true },
    selection: [],
    viewMode: "list",
  };
}

function emptyTab(over: Partial<Tab>): Tab {
  return {
    id: crypto.randomUUID(),
    kind: "dir",
    path: "",
    label: "/",
    repoKey: "",
    branch: "",
    entriesState: "idle",
    contentState: "idle",
    ...over,
  };
}

function tabLabel(path: string): string {
  if (path === "") return "/";
  const parts = path.split("/");
  return parts[parts.length - 1];
}

function languageFor(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "TypeScript", tsx: "TSX", js: "JavaScript", jsx: "JSX", json: "JSON",
    md: "Markdown", mdx: "MDX", html: "HTML", css: "CSS", scss: "SCSS",
    py: "Python", rb: "Ruby", go: "Go", rs: "Rust", java: "Java", kt: "Kotlin",
    c: "C", h: "C", cpp: "C++", cc: "C++", hpp: "C++", cs: "C#", php: "PHP",
    swift: "Swift", sh: "Shell", bash: "Shell", zsh: "Shell", yml: "YAML", yaml: "YAML",
    toml: "TOML", xml: "XML", sql: "SQL", vue: "Vue",
  };
  return map[ext] ?? (path.toLowerCase() === "dockerfile" ? "Dockerfile" : "Text");
}

export const initialState: State = {
  repos: {},
  activeRepoKey: null,
  pinnedRepoKeys: [],
  recent: [],
  repoRequests: {},
};

function updateRepo(state: State, repoKey: string, fn: (repo: RepoState) => RepoState): State {
  const repo = state.repos[repoKey];
  if (!repo) return state;
  return { ...state, repos: { ...state.repos, [repoKey]: fn(repo) } };
}

// Exported (test-only) so the regression suite can assert per-repo isolation
// by dispatching REPO_LOADING_FOR / REPO_LOADED / REPO_ERROR_FOR for two repos.
export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "REPO_LOADING_FOR": {
      // Only this repository's status changes — other repos are untouched,
      // so parallel hydration of Alpha + Beta stays independent.
      return {
        ...state,
        repoRequests: { ...state.repoRequests, [action.repoKey]: { loading: true, error: null } },
      };
    }
    case "REPO_LOADED": {
      const repoKey = action.meta.fullName;
      return {
        ...state,
        // Reconcile canonical vs requested casing of the repoKey.
        repoRequests: {
          ...state.repoRequests,
          [repoKey.toLowerCase()]: { loading: false, error: null },
        },
        activeRepoKey: repoKey,
        repos: { ...state.repos, [repoKey]: state.repos[repoKey] ?? emptyRepo(action.meta) },
        recent: state.recent.includes(repoKey) ? state.recent : [repoKey, ...state.recent].slice(0, 8),
      };
    }
    case "REPO_ERROR_FOR": {
      // Only this repository's status changes — other repos are untouched.
      return {
        ...state,
        repoRequests: {
          ...state.repoRequests,
          [action.repoKey]: { loading: false, error: action.error },
        },
      };
    }

    case "CLOSE_REPO":
      // Clear only the focused-repo pointer; per-repo hydration status is left
      // intact so re-opening the same repository does not flash a stale error.
      return { ...state, activeRepoKey: null };
    case "RELEASE_REPO": {
      if (!state.repos[action.repoKey]) return state;
      const repos = { ...state.repos };
      delete repos[action.repoKey];
      const repoRequests = { ...state.repoRequests };
      delete repoRequests[action.repoKey.toLowerCase()];
      return {
        ...state,
        repos,
        repoRequests,
        activeRepoKey: state.activeRepoKey === action.repoKey ? null : state.activeRepoKey,
        pinnedRepoKeys: state.pinnedRepoKeys.filter((k) => k !== action.repoKey),
      };
    }
    case "SWITCH_REPO":
      return state.repos[action.repoKey] ? { ...state, activeRepoKey: action.repoKey } : state;
    case "TOGGLE_PIN_REPO":
      return state.pinnedRepoKeys.includes(action.repoKey)
        ? { ...state, pinnedRepoKeys: state.pinnedRepoKeys.filter((k) => k !== action.repoKey) }
        : { ...state, pinnedRepoKeys: [...state.pinnedRepoKeys, action.repoKey] };
    case "ADD_TAB":
      return updateRepo(state, action.repoKey, (r) => ({ ...r, tabs: [...r.tabs, action.tab], activeTabId: action.activate ? action.tab.id : r.activeTabId }));
    case "CLOSE_TAB":
      return updateRepo(state, action.repoKey, (r) => {
        const idx = r.tabs.findIndex((t) => t.id === action.id);
        if (idx === -1) return r;
        const tabs = r.tabs.filter((t) => t.id !== action.id);
        let activeTabId = r.activeTabId;
        if (r.activeTabId === action.id) activeTabId = tabs[Math.min(idx, tabs.length - 1)]?.id ?? null;
        return { ...r, tabs, activeTabId };
      });
    case "SET_ACTIVE":
      return updateRepo(state, action.repoKey, (r) => ({ ...r, activeTabId: action.id }));
    case "MOVE_TAB":
      return updateRepo(state, action.repoKey, (r) => {
        if (action.from === action.to || action.from < 0 || action.to < 0 || action.from >= r.tabs.length || action.to >= r.tabs.length) return r;
        const tabs = [...r.tabs];
        const [moved] = tabs.splice(action.from, 1);
        tabs.splice(action.to, 0, moved);
        return { ...r, tabs };
      });
    case "DIR_LOADING":
      return updateRepo(state, action.repoKey, (r) => ({ ...r, treeState: { ...r.treeState, [action.path]: "loading" } }));
    case "DIR_LOADED":
      return updateRepo(state, action.repoKey, (r) => ({ ...r, treeCache: { ...r.treeCache, [action.path]: action.entries }, treeState: { ...r.treeState, [action.path]: "loaded" } }));
    case "DIR_ERROR":
      return updateRepo(state, action.repoKey, (r) => ({ ...r, treeState: { ...r.treeState, [action.path]: "error" } }));
    case "DIR_INVALIDATE":
      return updateRepo(state, action.repoKey, (r) => {
        const treeCache = { ...r.treeCache };
        const treeState = { ...r.treeState };
        delete treeCache[action.path];
        delete treeState[action.path];
        return { ...r, treeCache, treeState };
      });
    case "DIR_ATTACH":
      return updateRepo(state, action.repoKey, (r) => ({ ...r, tabs: r.tabs.map((t) => t.id === action.id ? { ...t, entries: action.entries, entriesState: "loaded", entriesError: undefined } : t) }));
    case "FILE_LOADING":
      return updateRepo(state, action.repoKey, (r) => ({ ...r, tabs: r.tabs.map((t) => t.id === action.id ? { ...t, contentState: "loading" } : t) }));
    case "FILE_LOADED":
      return updateRepo(state, action.repoKey, (r) => ({ ...r, tabs: r.tabs.map((t) => t.id === action.id ? { ...t, content: action.content, language: action.language, size: action.size, contentState: "loaded", contentError: undefined } : t) }));
    case "FILE_ERROR":
      return updateRepo(state, action.repoKey, (r) => ({ ...r, tabs: r.tabs.map((t) => t.id === action.id ? { ...t, contentState: "error", contentError: action.error } : t) }));
    case "SET_EXPANDED":
      return updateRepo(state, action.repoKey, (r) => ({ ...r, expanded: { ...r.expanded, [action.path]: action.value } }));
    case "SET_SELECTION":
      return updateRepo(state, action.repoKey, (r) => ({ ...r, selection: action.paths }));
    case "SET_BRANCH":
      return updateRepo(state, action.repoKey, (r) => ({ ...emptyRepo({ ...r.meta, branch: action.branch }), viewMode: r.viewMode }));
    case "SET_VIEW_MODE":
      return updateRepo(state, action.repoKey, (r) => ({ ...r, viewMode: action.viewMode }));
    default:
      return state;
  }
}

/** Repository-scoped slice of the store API. Every function targets one
 * fixed repository (inside a `RepoScope`) or the globally active one. */
type ScopedActions = {
  setBranch: (branch: string) => void;
  openPath: (path: string, kind: "file" | "dir", opts?: { newTab?: boolean }) => void;
  openInNewTab: (path: string, kind: "file" | "dir") => void;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  moveTab: (from: number, to: number) => void;
  ensureDir: (path: string) => Promise<GithubEntry[]>;
  ensureFile: (id: string, path: string) => Promise<void>;
  loadFolderTab: (id: string, path: string) => Promise<void>;
  toggleExpand: (path: string, value?: boolean) => void;
  setSelection: (paths: string[]) => void;
  setViewMode: (viewMode: ViewMode) => void;
  seedDir: (path: string, entries: GithubEntry[]) => void;
  invalidateDir: (path: string) => void;
};

type StoreContextValue = ScopedActions & {
  state: State;
  activeRepo: RepoState | null;
  openRepo: (input: string) => Promise<void>;
  closeRepo: () => void;
  releaseRepo: (repoKey: string) => void;
  switchRepo: (repoKey: string) => void;
  togglePinRepo: (repoKey: string) => void;
};

type StoreInternalValue = {
  state: State;
  actionsFor: (repoKey: string | null) => ScopedActions;
  openRepo: (input: string) => Promise<void>;
  closeRepo: () => void;
  releaseRepo: (repoKey: string) => void;
  switchRepo: (repoKey: string) => void;
  togglePinRepo: (repoKey: string) => void;
};

const StoreContext = createContext<StoreInternalValue | null>(null);

/** Fixes which repository the store hooks below this node operate on,
 * independent of the globally focused repo — one per repository window. */
const RepoScopeContext = createContext<string | null>(null);

export function RepoScope({ repoKey, children }: { repoKey: string; children: ReactNode }) {
  return <RepoScopeContext.Provider value={repoKey}>{children}</RepoScopeContext.Provider>;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const loadRoot = useCallback(async (meta: RepoMeta) => {
    const repoKey = meta.fullName;
    try {
      const root = await fetchContents(meta.owner, meta.repo, "", meta.branch);
      dispatch({ type: "DIR_LOADED", repoKey, path: "", entries: root });
      return root;
    } catch {
      dispatch({ type: "DIR_ERROR", repoKey, path: "" });
      return [];
    }
  }, []);

  const openRepo = useCallback(async (input: string) => {
    const parsed = parseRepoInput(input);
    if (!parsed) {
      dispatch({ type: "REPO_ERROR_FOR", repoKey: (input ?? "").toLowerCase(), error: "Invalid repository. Use owner/repo or a github.com URL." });
      return;
    }
    const reqKey = `${parsed.owner}/${parsed.repo}`.toLowerCase();
    dispatch({ type: "REPO_LOADING_FOR", repoKey: reqKey });
    try {
      const meta = await fetchRepoMeta(parsed.owner, parsed.repo);
      const repoKey = meta.fullName;
      const existed = Boolean(stateRef.current.repos[repoKey]);
      dispatch({ type: "REPO_LOADED", meta });
      if (!existed) {
        const root = await loadRoot(meta);
        dispatch({ type: "ADD_TAB", repoKey, activate: true, tab: emptyTab({ kind: "dir", path: "", label: meta.fullName, repoKey, branch: meta.branch, entries: root, entriesState: "loaded" }) });
      }
      try {
        const stored = JSON.parse(localStorage.getItem("gh-browser-recent") ?? "[]");
        const recent = [repoKey, ...stored.filter((r: string) => r !== repoKey)].slice(0, 8);
        localStorage.setItem("gh-browser-recent", JSON.stringify(recent));
      } catch { /* ignore */ }
    } catch (err) {
      dispatch({ type: "REPO_ERROR_FOR", repoKey: reqKey, error: err instanceof Error ? err.message : "Failed to load repository." });
    }
  }, [loadRoot]);

  const closeRepo = useCallback(() => dispatch({ type: "CLOSE_REPO" }), []);
  const releaseRepo = useCallback((repoKey: string) => dispatch({ type: "RELEASE_REPO", repoKey }), []);
  const switchRepo = useCallback((repoKey: string) => dispatch({ type: "SWITCH_REPO", repoKey }), []);
  const togglePinRepo = useCallback((repoKey: string) => dispatch({ type: "TOGGLE_PIN_REPO", repoKey }), []);

  // Scoped action sets are created once per repoKey (or once for the
  // "follow the active repo" null scope) and stay referentially stable —
  // they read current state through stateRef at call time.
  const scopedCache = useRef(new Map<string | null, ScopedActions>());
  const actionsFor = useCallback((scopeKey: string | null): ScopedActions => {
    const cached = scopedCache.current.get(scopeKey);
    if (cached) return cached;

    const resolve = (): { repoKey: string; repo: RepoState } | null => {
      const repoKey = scopeKey ?? stateRef.current.activeRepoKey;
      if (!repoKey) return null;
      const repo = stateRef.current.repos[repoKey];
      return repo ? { repoKey, repo } : null;
    };

    const ensureDir = async (path: string): Promise<GithubEntry[]> => {
      const target = resolve();
      if (!target) return [];
      const { repoKey, repo } = target;
      if (repo.treeCache[path] && repo.treeState[path] === "loaded") return repo.treeCache[path];
      dispatch({ type: "DIR_LOADING", repoKey, path });
      try {
        const entries = await fetchContents(repo.meta.owner, repo.meta.repo, path, repo.meta.branch);
        dispatch({ type: "DIR_LOADED", repoKey, path, entries });
        return entries;
      } catch {
        dispatch({ type: "DIR_ERROR", repoKey, path });
        return [];
      }
    };

    const ensureFile = async (id: string, path: string) => {
      const target = resolve();
      if (!target) return;
      const { repoKey, repo } = target;
      const tab = repo.tabs.find((t) => t.id === id);
      if (tab?.contentState === "loaded") return;
      dispatch({ type: "FILE_LOADING", repoKey, id });
      try {
        const { content, size } = await fetchFileContent(repo.meta.owner, repo.meta.repo, path, repo.meta.branch);
        dispatch({ type: "FILE_LOADED", repoKey, id, content, size, language: languageFor(path) });
      } catch (err) {
        dispatch({ type: "FILE_ERROR", repoKey, id, error: err instanceof Error ? err.message : "Failed to load file." });
      }
    };

    const loadFolderTab = async (id: string, path: string) => {
      const target = resolve();
      if (!target) return;
      const entries = await ensureDir(path);
      dispatch({ type: "DIR_ATTACH", repoKey: target.repoKey, id, entries });
    };

    const openPath = (path: string, kind: "file" | "dir", opts?: { newTab?: boolean }) => {
      const target = resolve();
      if (!target) return;
      const { repoKey, repo } = target;
      const existing = repo.tabs.find((t) => t.path === path && t.repoKey === repoKey);
      if (existing && !opts?.newTab) {
        dispatch({ type: "SET_ACTIVE", repoKey, id: existing.id });
        if (kind === "file" && existing.contentState === "idle") void ensureFile(existing.id, path);
        return;
      }
      const tab = emptyTab({ kind, path, label: tabLabel(path), repoKey, branch: repo.meta.branch });
      dispatch({ type: "ADD_TAB", repoKey, tab, activate: true });
      if (kind === "file") void ensureFile(tab.id, path);
      else void ensureDir(path).then((entries) => dispatch({ type: "DIR_ATTACH", repoKey, id: tab.id, entries }));
    };

    const actions: ScopedActions = {
      ensureDir,
      ensureFile,
      loadFolderTab,
      openPath,
      openInNewTab: (path, kind) => openPath(path, kind, { newTab: true }),
      setBranch: (branch) => {
        const target = resolve();
        if (!target) return;
        const { repoKey, repo } = target;
        const { owner, repo: name } = repo.meta;
        dispatch({ type: "SET_BRANCH", repoKey, branch });
        fetchContents(owner, name, "", branch)
          .then((root) => dispatch({ type: "DIR_LOADED", repoKey, path: "", entries: root }))
          .catch(() => dispatch({ type: "DIR_ERROR", repoKey, path: "" }));
      },
      closeTab: (id) => {
        const target = resolve();
        if (target) dispatch({ type: "CLOSE_TAB", repoKey: target.repoKey, id });
      },
      setActiveTab: (id) => {
        const target = resolve();
        if (!target) return;
        dispatch({ type: "SET_ACTIVE", repoKey: target.repoKey, id });
        const tab = target.repo.tabs.find((t) => t.id === id);
        if (tab?.kind === "file" && tab.contentState === "idle") void ensureFile(id, tab.path);
        else if (tab?.kind === "dir" && (tab.entriesState === "idle" || tab.entriesState === "error")) void loadFolderTab(id, tab.path);
      },
      moveTab: (from, to) => {
        const target = resolve();
        if (target) dispatch({ type: "MOVE_TAB", repoKey: target.repoKey, from, to });
      },
      toggleExpand: (path, value) => {
        const target = resolve();
        if (!target) return;
        const next = value ?? !target.repo.expanded[path];
        dispatch({ type: "SET_EXPANDED", repoKey: target.repoKey, path, value: next });
        if (next) void ensureDir(path);
      },
      setSelection: (paths) => {
        const target = resolve();
        if (target) dispatch({ type: "SET_SELECTION", repoKey: target.repoKey, paths });
      },
      setViewMode: (viewMode) => {
        const target = resolve();
        if (target) dispatch({ type: "SET_VIEW_MODE", repoKey: target.repoKey, viewMode });
      },
      seedDir: (path, entries) => {
        const target = resolve();
        if (target) dispatch({ type: "DIR_LOADED", repoKey: target.repoKey, path, entries });
      },
      invalidateDir: (path) => {
        const target = resolve();
        if (target) dispatch({ type: "DIR_INVALIDATE", repoKey: target.repoKey, path });
      },
    };
    scopedCache.current.set(scopeKey, actions);
    return actions;
  }, []);

  const value = useMemo<StoreInternalValue>(
    () => ({ state, actionsFor, openRepo, closeRepo, releaseRepo, switchRepo, togglePinRepo }),
    [state, actionsFor, openRepo, closeRepo, releaseRepo, switchRepo, togglePinRepo]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreContextValue {
  const context = useContext(StoreContext);
  const scope = useContext(RepoScopeContext);
  if (!context) throw new Error("useStore must be used within StoreProvider");
  return useMemo<StoreContextValue>(() => {
    const repoKey = scope ?? context.state.activeRepoKey;
    return {
      state: context.state,
      activeRepo: repoKey ? context.state.repos[repoKey] ?? null : null,
      openRepo: context.openRepo,
      closeRepo: context.closeRepo,
      releaseRepo: context.releaseRepo,
      switchRepo: context.switchRepo,
      togglePinRepo: context.togglePinRepo,
      ...context.actionsFor(scope),
    };
  }, [context, scope]);
}

/** The repository this component operates on: the enclosing `RepoScope`'s
 * repository inside a window, otherwise the globally focused one. */
export function useActiveRepo(): RepoState | null {
  return useStore().activeRepo;
}

/** Per-repository hydration status for `repoKey`, isolated from every other
 * repository window. Returns a neutral status when the key was never loaded. */
export function useRepoRequest(repoKey: string | null): RepoRequest {
  const { state } = useStore();
  return state.repoRequests[(repoKey ?? "").toLowerCase()] ?? { loading: false, error: null };
}

// Test-only alias for the regression suite (kept in sync with `reducer`).
export const __reducer = reducer;
