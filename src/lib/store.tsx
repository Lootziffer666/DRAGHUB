"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
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
};

type State = {
  repos: Record<string, RepoState>;
  activeRepoKey: string | null;
  pinnedRepoKeys: string[];
  recent: string[];
  repoError: string | null;
  repoLoading: boolean;
};

type Action =
  | { type: "REPO_LOADING" }
  | { type: "REPO_LOADED"; meta: RepoMeta }
  | { type: "REPO_ERROR"; error: string }
  | { type: "CLOSE_REPO" }
  | { type: "SWITCH_REPO"; repoKey: string }
  | { type: "ADD_TAB"; tab: Tab; activate: boolean }
  | { type: "CLOSE_TAB"; id: string }
  | { type: "SET_ACTIVE"; id: string }
  | { type: "MOVE_TAB"; from: number; to: number }
  | { type: "DIR_LOADING"; path: string }
  | { type: "DIR_LOADED"; path: string; entries: GithubEntry[] }
  | { type: "DIR_ERROR"; path: string }
  | { type: "DIR_INVALIDATE"; path: string }
  | { type: "DIR_ATTACH"; id: string; entries: GithubEntry[] }
  | { type: "FILE_LOADING"; id: string }
  | { type: "FILE_LOADED"; id: string; content: string; language: string; size: number }
  | { type: "FILE_ERROR"; id: string; error: string }
  | { type: "SET_EXPANDED"; path: string; value: boolean }
  | { type: "SET_SELECTION"; paths: string[] }
  | { type: "SET_BRANCH"; branch: string };

function emptyRepo(meta: RepoMeta): RepoState {
  return {
    meta,
    tabs: [],
    activeTabId: null,
    treeCache: {},
    treeState: {},
    expanded: { "": true },
    selection: [],
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

const initialState: State = {
  repos: {},
  activeRepoKey: null,
  pinnedRepoKeys: [],
  recent: [],
  repoError: null,
  repoLoading: false,
};

function updateActiveRepo(state: State, fn: (repo: RepoState) => RepoState): State {
  if (!state.activeRepoKey) return state;
  const repo = state.repos[state.activeRepoKey];
  if (!repo) return state;
  return { ...state, repos: { ...state.repos, [state.activeRepoKey]: fn(repo) } };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "REPO_LOADING":
      return { ...state, repoLoading: true, repoError: null };
    case "REPO_LOADED": {
      const repoKey = action.meta.fullName;
      return {
        ...state,
        repoLoading: false,
        repoError: null,
        activeRepoKey: repoKey,
        repos: { ...state.repos, [repoKey]: state.repos[repoKey] ?? emptyRepo(action.meta) },
        recent: state.recent.includes(repoKey) ? state.recent : [repoKey, ...state.recent].slice(0, 8),
      };
    }
    case "REPO_ERROR":
      return { ...state, repoLoading: false, repoError: action.error };
    case "CLOSE_REPO":
      return { ...state, activeRepoKey: null, repoError: null, repoLoading: false };
    case "SWITCH_REPO":
      return state.repos[action.repoKey] ? { ...state, activeRepoKey: action.repoKey } : state;
    case "ADD_TAB":
      return updateActiveRepo(state, (r) => ({ ...r, tabs: [...r.tabs, action.tab], activeTabId: action.activate ? action.tab.id : r.activeTabId }));
    case "CLOSE_TAB":
      return updateActiveRepo(state, (r) => {
        const idx = r.tabs.findIndex((t) => t.id === action.id);
        if (idx === -1) return r;
        const tabs = r.tabs.filter((t) => t.id !== action.id);
        let activeTabId = r.activeTabId;
        if (r.activeTabId === action.id) activeTabId = tabs[Math.min(idx, tabs.length - 1)]?.id ?? null;
        return { ...r, tabs, activeTabId };
      });
    case "SET_ACTIVE":
      return updateActiveRepo(state, (r) => ({ ...r, activeTabId: action.id }));
    case "MOVE_TAB":
      return updateActiveRepo(state, (r) => {
        if (action.from === action.to || action.from < 0 || action.to < 0 || action.from >= r.tabs.length || action.to >= r.tabs.length) return r;
        const tabs = [...r.tabs];
        const [moved] = tabs.splice(action.from, 1);
        tabs.splice(action.to, 0, moved);
        return { ...r, tabs };
      });
    case "DIR_LOADING":
      return updateActiveRepo(state, (r) => ({ ...r, treeState: { ...r.treeState, [action.path]: "loading" } }));
    case "DIR_LOADED":
      return updateActiveRepo(state, (r) => ({ ...r, treeCache: { ...r.treeCache, [action.path]: action.entries }, treeState: { ...r.treeState, [action.path]: "loaded" } }));
    case "DIR_ERROR":
      return updateActiveRepo(state, (r) => ({ ...r, treeState: { ...r.treeState, [action.path]: "error" } }));
    case "DIR_INVALIDATE":
      return updateActiveRepo(state, (r) => {
        const treeCache = { ...r.treeCache };
        const treeState = { ...r.treeState };
        delete treeCache[action.path];
        delete treeState[action.path];
        return { ...r, treeCache, treeState };
      });
    case "DIR_ATTACH":
      return updateActiveRepo(state, (r) => ({ ...r, tabs: r.tabs.map((t) => t.id === action.id ? { ...t, entries: action.entries, entriesState: "loaded", entriesError: undefined } : t) }));
    case "FILE_LOADING":
      return updateActiveRepo(state, (r) => ({ ...r, tabs: r.tabs.map((t) => t.id === action.id ? { ...t, contentState: "loading" } : t) }));
    case "FILE_LOADED":
      return updateActiveRepo(state, (r) => ({ ...r, tabs: r.tabs.map((t) => t.id === action.id ? { ...t, content: action.content, language: action.language, size: action.size, contentState: "loaded", contentError: undefined } : t) }));
    case "FILE_ERROR":
      return updateActiveRepo(state, (r) => ({ ...r, tabs: r.tabs.map((t) => t.id === action.id ? { ...t, contentState: "error", contentError: action.error } : t) }));
    case "SET_EXPANDED":
      return updateActiveRepo(state, (r) => ({ ...r, expanded: { ...r.expanded, [action.path]: action.value } }));
    case "SET_SELECTION":
      return updateActiveRepo(state, (r) => ({ ...r, selection: action.paths }));
    case "SET_BRANCH":
      return updateActiveRepo(state, (r) => ({ ...emptyRepo({ ...r.meta, branch: action.branch }) }));
    default:
      return state;
  }
}

type StoreContextValue = {
  state: State;
  activeRepo: RepoState | null;
  openRepo: (input: string) => Promise<void>;
  closeRepo: () => void;
  switchRepo: (repoKey: string) => void;
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
  seedDir: (path: string, entries: GithubEntry[]) => void;
  invalidateDir: (path: string) => void;
};

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const activeRepo = state.activeRepoKey ? state.repos[state.activeRepoKey] ?? null : null;

  const loadRoot = useCallback(async (meta: RepoMeta) => {
    try {
      const root = await fetchContents(meta.owner, meta.repo, "", meta.branch);
      dispatch({ type: "DIR_LOADED", path: "", entries: root });
      return root;
    } catch {
      dispatch({ type: "DIR_ERROR", path: "" });
      return [];
    }
  }, []);

  const openRepo = useCallback(async (input: string) => {
    const parsed = parseRepoInput(input);
    if (!parsed) {
      dispatch({ type: "REPO_ERROR", error: "Invalid repository. Use owner/repo or a github.com URL." });
      return;
    }
    dispatch({ type: "REPO_LOADING" });
    try {
      const meta = await fetchRepoMeta(parsed.owner, parsed.repo);
      const repoKey = meta.fullName;
      const existed = Boolean(state.repos[repoKey]);
      dispatch({ type: "REPO_LOADED", meta });
      let root: GithubEntry[] = [];
      if (!existed) {
        root = await loadRoot(meta);
        dispatch({ type: "ADD_TAB", activate: true, tab: emptyTab({ kind: "dir", path: "", label: meta.fullName, repoKey, branch: meta.branch, entries: root, entriesState: "loaded" }) });
      }
      try {
        const stored = JSON.parse(localStorage.getItem("gh-browser-recent") ?? "[]");
        const recent = [repoKey, ...stored.filter((r: string) => r !== repoKey)].slice(0, 8);
        localStorage.setItem("gh-browser-recent", JSON.stringify(recent));
      } catch { /* ignore */ }
    } catch (err) {
      dispatch({ type: "REPO_ERROR", error: err instanceof Error ? err.message : "Failed to load repository." });
    }
  }, [loadRoot, state.repos]);

  const closeRepo = useCallback(() => dispatch({ type: "CLOSE_REPO" }), []);
  const switchRepo = useCallback((repoKey: string) => dispatch({ type: "SWITCH_REPO", repoKey }), []);

  const setBranch = useCallback((branch: string) => {
    if (!activeRepo) return;
    const { owner, repo } = activeRepo.meta;
    dispatch({ type: "SET_BRANCH", branch });
    fetchContents(owner, repo, "", branch)
      .then((root) => dispatch({ type: "DIR_LOADED", path: "", entries: root }))
      .catch(() => dispatch({ type: "DIR_ERROR", path: "" }));
  }, [activeRepo]);

  const ensureDir = useCallback(async (path: string): Promise<GithubEntry[]> => {
    if (!activeRepo) return [];
    if (activeRepo.treeCache[path] && activeRepo.treeState[path] === "loaded") return activeRepo.treeCache[path];
    dispatch({ type: "DIR_LOADING", path });
    try {
      const entries = await fetchContents(activeRepo.meta.owner, activeRepo.meta.repo, path, activeRepo.meta.branch);
      dispatch({ type: "DIR_LOADED", path, entries });
      return entries;
    } catch {
      dispatch({ type: "DIR_ERROR", path });
      return [];
    }
  }, [activeRepo]);

  const ensureFile = useCallback(async (id: string, path: string) => {
    if (!activeRepo) return;
    const tab = activeRepo.tabs.find((t) => t.id === id);
    if (tab?.contentState === "loaded") return;
    dispatch({ type: "FILE_LOADING", id });
    try {
      const { content, size } = await fetchFileContent(activeRepo.meta.owner, activeRepo.meta.repo, path, activeRepo.meta.branch);
      dispatch({ type: "FILE_LOADED", id, content, size, language: languageFor(path) });
    } catch (err) {
      dispatch({ type: "FILE_ERROR", id, error: err instanceof Error ? err.message : "Failed to load file." });
    }
  }, [activeRepo]);

  const openPath = useCallback((path: string, kind: "file" | "dir", opts?: { newTab?: boolean }) => {
    if (!activeRepo) return;
    const meta = activeRepo.meta;
    const existing = activeRepo.tabs.find((t) => t.path === path && t.repoKey === meta.fullName);
    if (existing && !opts?.newTab) {
      dispatch({ type: "SET_ACTIVE", id: existing.id });
      if (kind === "file" && existing.contentState === "idle") void ensureFile(existing.id, path);
      return;
    }
    const tab = emptyTab({ kind, path, label: tabLabel(path), repoKey: meta.fullName, branch: meta.branch });
    dispatch({ type: "ADD_TAB", tab, activate: true });
    if (kind === "file") void ensureFile(tab.id, path);
    else void ensureDir(path).then((entries) => dispatch({ type: "DIR_ATTACH", id: tab.id, entries }));
  }, [activeRepo, ensureDir, ensureFile]);

  const openInNewTab = useCallback((path: string, kind: "file" | "dir") => openPath(path, kind, { newTab: true }), [openPath]);
  const closeTab = useCallback((id: string) => dispatch({ type: "CLOSE_TAB", id }), []);
  const loadFolderTab = useCallback(async (id: string, path: string) => { const entries = await ensureDir(path); dispatch({ type: "DIR_ATTACH", id, entries }); }, [ensureDir]);
  const setActiveTab = useCallback((id: string) => {
    dispatch({ type: "SET_ACTIVE", id });
    const tab = activeRepo?.tabs.find((t) => t.id === id);
    if (tab?.kind === "file" && tab.contentState === "idle") void ensureFile(id, tab.path);
    else if (tab?.kind === "dir" && (tab.entriesState === "idle" || tab.entriesState === "error")) void loadFolderTab(id, tab.path);
  }, [activeRepo, ensureFile, loadFolderTab]);
  const moveTab = useCallback((from: number, to: number) => dispatch({ type: "MOVE_TAB", from, to }), []);
  const toggleExpand = useCallback((path: string, value?: boolean) => { const next = value ?? !activeRepo?.expanded[path]; dispatch({ type: "SET_EXPANDED", path, value: next }); if (next) void ensureDir(path); }, [activeRepo, ensureDir]);
  const setSelection = useCallback((paths: string[]) => dispatch({ type: "SET_SELECTION", paths }), []);
  const seedDir = useCallback((path: string, entries: GithubEntry[]) => dispatch({ type: "DIR_LOADED", path, entries }), []);
  const invalidateDir = useCallback((path: string) => dispatch({ type: "DIR_INVALIDATE", path }), []);

  const value = useMemo<StoreContextValue>(() => ({ state, activeRepo, openRepo, closeRepo, switchRepo, setBranch, openPath, openInNewTab, closeTab, setActiveTab, moveTab, ensureDir, ensureFile, loadFolderTab, toggleExpand, setSelection, seedDir, invalidateDir }), [state, activeRepo, openRepo, closeRepo, switchRepo, setBranch, openPath, openInNewTab, closeTab, setActiveTab, moveTab, ensureDir, ensureFile, loadFolderTab, toggleExpand, setSelection, seedDir, invalidateDir]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}

export function useActiveRepo(): RepoState | null {
  return useStore().activeRepo;
}
