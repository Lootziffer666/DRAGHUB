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

/** "city" is reserved for a future Phase-2 3D renderer — not selectable yet. */
export type ViewMode = "list" | "grid" | "city";

/** Per-repository workspace state (M8). Key = "owner/repo". */
export type RepoState = {
  meta: RepoMeta;
  tabs: Tab[];
  activeTabId: string | null;
  treeCache: Record<string, GithubEntry[]>;
  treeState: Record<string, "loading" | "loaded" | "error">;
  expanded: Record<string, boolean>;
  selection: string[];
};

type MultiState = {
  repos: Record<string, RepoState>;
  activeRepoKey: string | null;
  repoError: string | null;
  repoLoading: boolean;
  recent: string[];
  viewMode: ViewMode;
};

/**
 * The legacy single-repo view every existing consumer reads. Derived from
 * MultiState by projecting the active repo — components didn't have to
 * change for the M8 refactor because this shape is unchanged.
 */
export type StateView = {
  meta: RepoMeta | null;
  repoError: string | null;
  repoLoading: boolean;
  tabs: Tab[];
  activeTabId: string | null;
  treeCache: Record<string, GithubEntry[]>;
  treeState: Record<string, "loading" | "loaded" | "error">;
  expanded: Record<string, boolean>;
  selection: string[];
  recent: string[];
  viewMode: ViewMode;
};

type Action =
  | { type: "REPO_LOADING" }
  | { type: "REPO_LOADED"; meta: RepoMeta }
  | { type: "REPO_ERROR"; error: string }
  | { type: "SWITCH_REPO"; repoKey: string }
  | { type: "CLOSE_REPO"; repoKey: string }
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
  | {
      type: "FILE_LOADED";
      repoKey: string;
      id: string;
      content: string;
      language: string;
      size: number;
    }
  | { type: "FILE_ERROR"; repoKey: string; id: string; error: string }
  | { type: "SET_EXPANDED"; repoKey: string; path: string; value: boolean }
  | { type: "SET_SELECTION"; repoKey: string; paths: string[] }
  | { type: "SET_BRANCH"; repoKey: string; branch: string }
  | { type: "SET_VIEW_MODE"; mode: ViewMode };

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
    ts: "TypeScript",
    tsx: "TSX",
    js: "JavaScript",
    jsx: "JSX",
    json: "JSON",
    md: "Markdown",
    mdx: "MDX",
    html: "HTML",
    css: "CSS",
    scss: "SCSS",
    py: "Python",
    rb: "Ruby",
    go: "Go",
    rs: "Rust",
    java: "Java",
    kt: "Kotlin",
    c: "C",
    h: "C",
    cpp: "C++",
    cc: "C++",
    hpp: "C++",
    cs: "C#",
    php: "PHP",
    swift: "Swift",
    sh: "Shell",
    bash: "Shell",
    zsh: "Shell",
    yml: "YAML",
    yaml: "YAML",
    toml: "TOML",
    xml: "XML",
    sql: "SQL",
    vue: "Vue",
  };
  return map[ext] ?? (path.toLowerCase() === "dockerfile" ? "Dockerfile" : "Text");
}

function freshRepoState(meta: RepoMeta): RepoState {
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

function initialViewMode(): ViewMode {
  if (typeof localStorage === "undefined") return "list";
  const stored = localStorage.getItem("gh-browser-view-mode");
  return stored === "grid" ? "grid" : "list";
}

const initialState: MultiState = {
  repos: {},
  activeRepoKey: null,
  repoError: null,
  repoLoading: false,
  recent: [],
  viewMode: initialViewMode(),
};

/** Applies `fn` to one repo's state; a no-op if that repo was closed in the
 * meantime (async loads can resolve after a close/switch). */
function updateRepo(
  state: MultiState,
  repoKey: string,
  fn: (repo: RepoState) => RepoState
): MultiState {
  const repo = state.repos[repoKey];
  if (!repo) return state;
  return { ...state, repos: { ...state.repos, [repoKey]: fn(repo) } };
}

function reducer(state: MultiState, action: Action): MultiState {
  switch (action.type) {
    case "REPO_LOADING":
      return { ...state, repoLoading: true, repoError: null };
    case "REPO_LOADED": {
      const key = action.meta.fullName;
      return {
        ...state,
        repoLoading: false,
        repoError: null,
        repos: { ...state.repos, [key]: freshRepoState(action.meta) },
        activeRepoKey: key,
        recent: state.recent.includes(key)
          ? state.recent
          : [key, ...state.recent].slice(0, 8),
      };
    }
    case "REPO_ERROR":
      return { ...state, repoLoading: false, repoError: action.error };
    case "SWITCH_REPO":
      if (!state.repos[action.repoKey]) return state;
      return { ...state, activeRepoKey: action.repoKey, repoError: null };
    case "CLOSE_REPO": {
      const repos = { ...state.repos };
      delete repos[action.repoKey];
      let activeRepoKey = state.activeRepoKey;
      if (activeRepoKey === action.repoKey) {
        const remaining = Object.keys(repos);
        activeRepoKey = remaining.length > 0 ? remaining[remaining.length - 1] : null;
      }
      return { ...state, repos, activeRepoKey };
    }
    case "ADD_TAB":
      return updateRepo(state, action.repoKey, (repo) => ({
        ...repo,
        tabs: [...repo.tabs, action.tab],
        activeTabId: action.activate ? action.tab.id : repo.activeTabId,
      }));
    case "CLOSE_TAB":
      return updateRepo(state, action.repoKey, (repo) => {
        const idx = repo.tabs.findIndex((t) => t.id === action.id);
        if (idx === -1) return repo;
        const tabs = repo.tabs.filter((t) => t.id !== action.id);
        let activeTabId = repo.activeTabId;
        if (repo.activeTabId === action.id) {
          const next = tabs[Math.min(idx, tabs.length - 1)];
          activeTabId = next ? next.id : null;
        }
        return { ...repo, tabs, activeTabId };
      });
    case "SET_ACTIVE":
      return updateRepo(state, action.repoKey, (repo) => ({
        ...repo,
        activeTabId: action.id,
      }));
    case "MOVE_TAB":
      return updateRepo(state, action.repoKey, (repo) => {
        if (
          action.from === action.to ||
          action.from < 0 ||
          action.to < 0 ||
          action.from >= repo.tabs.length ||
          action.to >= repo.tabs.length
        )
          return repo;
        const tabs = [...repo.tabs];
        const [moved] = tabs.splice(action.from, 1);
        tabs.splice(action.to, 0, moved);
        return { ...repo, tabs };
      });
    case "DIR_LOADING":
      return updateRepo(state, action.repoKey, (repo) => ({
        ...repo,
        treeState: { ...repo.treeState, [action.path]: "loading" },
      }));
    case "DIR_LOADED":
      return updateRepo(state, action.repoKey, (repo) => ({
        ...repo,
        treeCache: { ...repo.treeCache, [action.path]: action.entries },
        treeState: { ...repo.treeState, [action.path]: "loaded" },
      }));
    case "DIR_ERROR":
      return updateRepo(state, action.repoKey, (repo) => ({
        ...repo,
        treeState: { ...repo.treeState, [action.path]: "error" },
      }));
    case "DIR_INVALIDATE":
      return updateRepo(state, action.repoKey, (repo) => {
        const treeCache = { ...repo.treeCache };
        const treeState = { ...repo.treeState };
        delete treeCache[action.path];
        delete treeState[action.path];
        return { ...repo, treeCache, treeState };
      });
    case "DIR_ATTACH":
      return updateRepo(state, action.repoKey, (repo) => ({
        ...repo,
        tabs: repo.tabs.map((t) =>
          t.id === action.id
            ? {
                ...t,
                entries: action.entries,
                entriesState: "loaded",
                entriesError: undefined,
              }
            : t
        ),
      }));
    case "FILE_LOADING":
      return updateRepo(state, action.repoKey, (repo) => ({
        ...repo,
        tabs: repo.tabs.map((t) =>
          t.id === action.id ? { ...t, contentState: "loading" } : t
        ),
      }));
    case "FILE_LOADED":
      return updateRepo(state, action.repoKey, (repo) => ({
        ...repo,
        tabs: repo.tabs.map((t) =>
          t.id === action.id
            ? {
                ...t,
                content: action.content,
                language: action.language,
                size: action.size,
                contentState: "loaded",
                contentError: undefined,
              }
            : t
        ),
      }));
    case "FILE_ERROR":
      return updateRepo(state, action.repoKey, (repo) => ({
        ...repo,
        tabs: repo.tabs.map((t) =>
          t.id === action.id
            ? { ...t, contentState: "error", contentError: action.error }
            : t
        ),
      }));
    case "SET_EXPANDED":
      return updateRepo(state, action.repoKey, (repo) => ({
        ...repo,
        expanded: { ...repo.expanded, [action.path]: action.value },
      }));
    case "SET_SELECTION":
      return updateRepo(state, action.repoKey, (repo) => ({
        ...repo,
        selection: action.paths,
      }));
    case "SET_BRANCH":
      return updateRepo(state, action.repoKey, (repo) => ({
        ...freshRepoState({ ...repo.meta, branch: action.branch }),
      }));
    case "SET_VIEW_MODE":
      return { ...state, viewMode: action.mode };
    default:
      return state;
  }
}

type StoreContextValue = {
  state: StateView;
  /** All currently open repositories, in insertion order. */
  openRepoKeys: string[];
  activeRepoKey: string | null;
  openRepo: (input: string) => Promise<void>;
  switchRepo: (repoKey: string) => void;
  closeRepo: () => void;
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
  setViewMode: (mode: ViewMode) => void;
  /** Seed a directory's entries locally without a network fetch (used for
   * pending-new folders that don't exist on GitHub yet). */
  seedDir: (path: string, entries: GithubEntry[]) => void;
  /** Drop cached entries for a path so the next ensureDir re-fetches it. */
  invalidateDir: (path: string) => void;
};

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [multi, dispatch] = useReducer(reducer, initialState);

  // Ref mirror so async callbacks always see the current state and can
  // capture the repo key they were started for.
  const multiRef = useRef(multi);
  multiRef.current = multi;

  const activeRepo = multi.activeRepoKey ? (multi.repos[multi.activeRepoKey] ?? null) : null;

  const view = useMemo<StateView>(
    () => ({
      meta: activeRepo?.meta ?? null,
      repoError: multi.repoError,
      repoLoading: multi.repoLoading,
      tabs: activeRepo?.tabs ?? [],
      activeTabId: activeRepo?.activeTabId ?? null,
      treeCache: activeRepo?.treeCache ?? {},
      treeState: activeRepo?.treeState ?? {},
      expanded: activeRepo?.expanded ?? { "": true },
      selection: activeRepo?.selection ?? [],
      recent: multi.recent,
      viewMode: multi.viewMode,
    }),
    [activeRepo, multi.repoError, multi.repoLoading, multi.recent, multi.viewMode]
  );

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

  const openRepo = useCallback(
    async (input: string) => {
      const parsed = parseRepoInput(input);
      if (!parsed) {
        dispatch({
          type: "REPO_ERROR",
          error: "Invalid repository. Use owner/repo or a github.com URL.",
        });
        return;
      }
      // Already open? Switch to it, keeping its tabs/tree/selection intact.
      const existingKey = Object.keys(multiRef.current.repos).find(
        (k) => k.toLowerCase() === `${parsed.owner}/${parsed.repo}`.toLowerCase()
      );
      if (existingKey) {
        dispatch({ type: "SWITCH_REPO", repoKey: existingKey });
        return;
      }
      dispatch({ type: "REPO_LOADING" });
      try {
        const meta = await fetchRepoMeta(parsed.owner, parsed.repo);
        dispatch({ type: "REPO_LOADED", meta });
        const root = await loadRoot(meta);
        try {
          const stored = JSON.parse(
            localStorage.getItem("gh-browser-recent") ?? "[]"
          );
          const recent = [
            meta.fullName,
            ...stored.filter((r: string) => r !== meta.fullName),
          ].slice(0, 8);
          localStorage.setItem("gh-browser-recent", JSON.stringify(recent));
        } catch {
          /* ignore */
        }
        dispatch({
          type: "ADD_TAB",
          repoKey: meta.fullName,
          activate: true,
          tab: emptyTab({
            kind: "dir",
            path: "",
            label: meta.fullName,
            repoKey: meta.fullName,
            branch: meta.branch,
            entries: root,
            entriesState: "loaded",
          }),
        });
      } catch (err) {
        dispatch({
          type: "REPO_ERROR",
          error: err instanceof Error ? err.message : "Failed to load repository.",
        });
      }
    },
    [loadRoot]
  );

  const switchRepo = useCallback((repoKey: string) => {
    dispatch({ type: "SWITCH_REPO", repoKey });
  }, []);

  const closeRepo = useCallback(() => {
    const key = multiRef.current.activeRepoKey;
    if (key) dispatch({ type: "CLOSE_REPO", repoKey: key });
  }, []);

  const setBranch = useCallback((branch: string) => {
    const current = multiRef.current;
    const key = current.activeRepoKey;
    const repo = key ? current.repos[key] : null;
    if (!key || !repo) return;
    dispatch({ type: "SET_BRANCH", repoKey: key, branch });
    const { owner, repo: repoName } = repo.meta;
    fetchContents(owner, repoName, "", branch)
      .then((root) => dispatch({ type: "DIR_LOADED", repoKey: key, path: "", entries: root }))
      .catch(() => dispatch({ type: "DIR_ERROR", repoKey: key, path: "" }));
  }, []);

  const ensureDir = useCallback(async (path: string): Promise<GithubEntry[]> => {
    const current = multiRef.current;
    const key = current.activeRepoKey;
    const repo = key ? current.repos[key] : null;
    if (!key || !repo) return [];
    if (repo.treeCache[path] && repo.treeState[path] === "loaded") {
      return repo.treeCache[path];
    }
    dispatch({ type: "DIR_LOADING", repoKey: key, path });
    try {
      const entries = await fetchContents(
        repo.meta.owner,
        repo.meta.repo,
        path,
        repo.meta.branch
      );
      dispatch({ type: "DIR_LOADED", repoKey: key, path, entries });
      return entries;
    } catch {
      dispatch({ type: "DIR_ERROR", repoKey: key, path });
      return [];
    }
  }, []);

  const ensureFile = useCallback(async (id: string, path: string) => {
    const current = multiRef.current;
    const key = current.activeRepoKey;
    const repo = key ? current.repos[key] : null;
    if (!key || !repo) return;
    const tab = repo.tabs.find((t) => t.id === id);
    if (tab && tab.contentState === "loaded") return;
    dispatch({ type: "FILE_LOADING", repoKey: key, id });
    try {
      const { content, size } = await fetchFileContent(
        repo.meta.owner,
        repo.meta.repo,
        path,
        repo.meta.branch
      );
      dispatch({
        type: "FILE_LOADED",
        repoKey: key,
        id,
        content,
        size,
        language: languageFor(path),
      });
    } catch (err) {
      dispatch({
        type: "FILE_ERROR",
        repoKey: key,
        id,
        error: err instanceof Error ? err.message : "Failed to load file.",
      });
    }
  }, []);

  const openPath = useCallback(
    (path: string, kind: "file" | "dir", opts?: { newTab?: boolean }) => {
      const current = multiRef.current;
      const key = current.activeRepoKey;
      const repo = key ? current.repos[key] : null;
      if (!key || !repo) return;
      const existing = repo.tabs.find(
        (t) => t.path === path && t.repoKey === key
      );
      if (existing && !opts?.newTab) {
        dispatch({ type: "SET_ACTIVE", repoKey: key, id: existing.id });
        if (kind === "file" && existing.contentState === "idle") {
          void ensureFile(existing.id, path);
        }
        return;
      }
      const tab = emptyTab({
        kind,
        path,
        label: tabLabel(path),
        repoKey: key,
        branch: repo.meta.branch,
      });
      dispatch({ type: "ADD_TAB", repoKey: key, tab, activate: true });
      if (kind === "file") {
        void ensureFile(tab.id, path);
      } else {
        void ensureDir(path).then((entries) =>
          dispatch({ type: "DIR_ATTACH", repoKey: key, id: tab.id, entries })
        );
      }
    },
    [ensureDir, ensureFile]
  );

  const openInNewTab = useCallback(
    (path: string, kind: "file" | "dir") => openPath(path, kind, { newTab: true }),
    [openPath]
  );

  const closeTab = useCallback((id: string) => {
    const key = multiRef.current.activeRepoKey;
    if (key) dispatch({ type: "CLOSE_TAB", repoKey: key, id });
  }, []);

  const loadFolderTab = useCallback(
    async (id: string, path: string) => {
      const key = multiRef.current.activeRepoKey;
      if (!key) return;
      const entries = await ensureDir(path);
      dispatch({ type: "DIR_ATTACH", repoKey: key, id, entries });
    },
    [ensureDir]
  );

  const setActiveTab = useCallback(
    (id: string) => {
      const current = multiRef.current;
      const key = current.activeRepoKey;
      const repo = key ? current.repos[key] : null;
      if (!key || !repo) return;
      dispatch({ type: "SET_ACTIVE", repoKey: key, id });
      const tab = repo.tabs.find((t) => t.id === id);
      if (tab && tab.kind === "file" && tab.contentState === "idle") {
        void ensureFile(id, tab.path);
      } else if (
        tab &&
        tab.kind === "dir" &&
        (tab.entriesState === "idle" || tab.entriesState === "error")
      ) {
        void loadFolderTab(id, tab.path);
      }
    },
    [ensureFile, loadFolderTab]
  );

  const moveTab = useCallback((from: number, to: number) => {
    const key = multiRef.current.activeRepoKey;
    if (key) dispatch({ type: "MOVE_TAB", repoKey: key, from, to });
  }, []);

  const toggleExpand = useCallback(
    (path: string, value?: boolean) => {
      const current = multiRef.current;
      const key = current.activeRepoKey;
      const repo = key ? current.repos[key] : null;
      if (!key || !repo) return;
      const next = value ?? !repo.expanded[path];
      dispatch({ type: "SET_EXPANDED", repoKey: key, path, value: next });
      if (next) void ensureDir(path);
    },
    [ensureDir]
  );

  const setSelection = useCallback((paths: string[]) => {
    const key = multiRef.current.activeRepoKey;
    if (key) dispatch({ type: "SET_SELECTION", repoKey: key, paths });
  }, []);

  const setViewMode = useCallback((mode: ViewMode) => {
    dispatch({ type: "SET_VIEW_MODE", mode });
    try {
      localStorage.setItem("gh-browser-view-mode", mode);
    } catch {
      /* ignore */
    }
  }, []);

  const seedDir = useCallback((path: string, entries: GithubEntry[]) => {
    const key = multiRef.current.activeRepoKey;
    if (key) dispatch({ type: "DIR_LOADED", repoKey: key, path, entries });
  }, []);

  const invalidateDir = useCallback((path: string) => {
    const key = multiRef.current.activeRepoKey;
    if (key) dispatch({ type: "DIR_INVALIDATE", repoKey: key, path });
  }, []);

  const openRepoKeys = useMemo(() => Object.keys(multi.repos), [multi.repos]);

  const value = useMemo<StoreContextValue>(
    () => ({
      state: view,
      openRepoKeys,
      activeRepoKey: multi.activeRepoKey,
      openRepo,
      switchRepo,
      closeRepo,
      setBranch,
      openPath,
      openInNewTab,
      closeTab,
      setActiveTab,
      moveTab,
      ensureDir,
      ensureFile,
      loadFolderTab,
      toggleExpand,
      setSelection,
      setViewMode,
      seedDir,
      invalidateDir,
    }),
    [
      view,
      openRepoKeys,
      multi.activeRepoKey,
      openRepo,
      switchRepo,
      closeRepo,
      setBranch,
      openPath,
      openInNewTab,
      closeTab,
      setActiveTab,
      moveTab,
      ensureDir,
      ensureFile,
      loadFolderTab,
      toggleExpand,
      setSelection,
      setViewMode,
      seedDir,
      invalidateDir,
    ]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
