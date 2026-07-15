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

type State = {
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
};

type Action =
  | { type: "REPO_LOADING" }
  | { type: "REPO_LOADED"; meta: RepoMeta }
  | { type: "REPO_ERROR"; error: string }
  | { type: "CLOSE_REPO" }
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
  | {
      type: "FILE_LOADED";
      id: string;
      content: string;
      language: string;
      size: number;
    }
  | { type: "FILE_ERROR"; id: string; error: string }
  | { type: "SET_EXPANDED"; path: string; value: boolean }
  | { type: "SET_SELECTION"; paths: string[] }
  | { type: "SET_BRANCH"; branch: string };

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

const initialState: State = {
  meta: null,
  repoError: null,
  repoLoading: false,
  tabs: [],
  activeTabId: null,
  treeCache: {},
  treeState: {},
  expanded: { "": true },
  selection: [],
  recent: [],
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "REPO_LOADING":
      return { ...state, repoLoading: true, repoError: null };
    case "REPO_LOADED":
      return {
        ...state,
        repoLoading: false,
        repoError: null,
        meta: action.meta,
        tabs: [],
        activeTabId: null,
        treeCache: {},
        treeState: {},
        expanded: { "": true },
        selection: [],
        recent: state.recent.includes(action.meta.fullName)
          ? state.recent
          : [action.meta.fullName, ...state.recent].slice(0, 8),
      };
    case "REPO_ERROR":
      return { ...state, repoLoading: false, repoError: action.error };
    case "CLOSE_REPO":
      return {
        ...initialState,
        recent: state.recent,
      };
    case "ADD_TAB": {
      const tabs = [...state.tabs, action.tab];
      return {
        ...state,
        tabs,
        activeTabId: action.activate ? action.tab.id : state.activeTabId,
      };
    }
    case "CLOSE_TAB": {
      const idx = state.tabs.findIndex((t) => t.id === action.id);
      if (idx === -1) return state;
      const tabs = state.tabs.filter((t) => t.id !== action.id);
      let activeTabId = state.activeTabId;
      if (state.activeTabId === action.id) {
        const next = tabs[Math.min(idx, tabs.length - 1)];
        activeTabId = next ? next.id : null;
      }
      return { ...state, tabs, activeTabId };
    }
    case "SET_ACTIVE":
      return { ...state, activeTabId: action.id };
    case "MOVE_TAB": {
      if (
        action.from === action.to ||
        action.from < 0 ||
        action.to < 0 ||
        action.from >= state.tabs.length ||
        action.to >= state.tabs.length
      )
        return state;
      const tabs = [...state.tabs];
      const [moved] = tabs.splice(action.from, 1);
      tabs.splice(action.to, 0, moved);
      return { ...state, tabs };
    }
    case "DIR_LOADING":
      return {
        ...state,
        treeState: { ...state.treeState, [action.path]: "loading" },
      };
    case "DIR_LOADED":
      return {
        ...state,
        treeCache: { ...state.treeCache, [action.path]: action.entries },
        treeState: { ...state.treeState, [action.path]: "loaded" },
      };
    case "DIR_ERROR":
      return {
        ...state,
        treeState: { ...state.treeState, [action.path]: "error" },
      };
    case "DIR_INVALIDATE": {
      const treeCache = { ...state.treeCache };
      const treeState = { ...state.treeState };
      delete treeCache[action.path];
      delete treeState[action.path];
      return { ...state, treeCache, treeState };
    }
    case "DIR_ATTACH":
      return {
        ...state,
        tabs: state.tabs.map((t) =>
          t.id === action.id
            ? {
                ...t,
                entries: action.entries,
                entriesState: "loaded",
                entriesError: undefined,
              }
            : t
        ),
      };
    case "FILE_LOADING":
      return {
        ...state,
        tabs: state.tabs.map((t) =>
          t.id === action.id ? { ...t, contentState: "loading" } : t
        ),
      };
    case "FILE_LOADED":
      return {
        ...state,
        tabs: state.tabs.map((t) =>
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
      };
    case "FILE_ERROR":
      return {
        ...state,
        tabs: state.tabs.map((t) =>
          t.id === action.id
            ? { ...t, contentState: "error", contentError: action.error }
            : t
        ),
      };
    case "SET_EXPANDED":
      return {
        ...state,
        expanded: { ...state.expanded, [action.path]: action.value },
      };
    case "SET_SELECTION":
      return { ...state, selection: action.paths };
    case "SET_BRANCH":
      if (!state.meta) return state;
      return {
        ...state,
        meta: { ...state.meta, branch: action.branch },
        tabs: [],
        activeTabId: null,
        treeCache: {},
        treeState: {},
        expanded: { "": true },
        selection: [],
      };
    default:
      return state;
  }
}

type StoreContextValue = {
  state: State;
  openRepo: (input: string) => Promise<void>;
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
  /** Seed a directory's entries locally without a network fetch (used for
   * pending-new folders that don't exist on GitHub yet). */
  seedDir: (path: string, entries: GithubEntry[]) => void;
  /** Drop cached entries for a path so the next ensureDir re-fetches it. */
  invalidateDir: (path: string) => void;
};

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const loadRoot = useCallback(
    async (meta: RepoMeta) => {
      try {
        const root = await fetchContents(meta.owner, meta.repo, "", meta.branch);
        dispatch({ type: "DIR_LOADED", path: "", entries: root });
        return root;
      } catch {
        dispatch({ type: "DIR_ERROR", path: "" });
        return [];
      }
    },
    []
  );

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

  const closeRepo = useCallback(() => {
    dispatch({ type: "CLOSE_REPO" });
  }, []);

  const setBranch = useCallback(
    (branch: string) => {
      dispatch({ type: "SET_BRANCH", branch });
      if (state.meta) {
        const { owner, repo } = state.meta;
        fetchContents(owner, repo, "", branch)
          .then((root) => dispatch({ type: "DIR_LOADED", path: "", entries: root }))
          .catch(() => dispatch({ type: "DIR_ERROR", path: "" }));
      }
    },
    [state.meta]
  );

  const ensureDir = useCallback(
    async (path: string): Promise<GithubEntry[]> => {
      if (state.treeCache[path] && state.treeState[path] === "loaded") {
        return state.treeCache[path];
      }
      if (!state.meta) return [];
      dispatch({ type: "DIR_LOADING", path });
      try {
        const entries = await fetchContents(
          state.meta.owner,
          state.meta.repo,
          path,
          state.meta.branch
        );
        dispatch({ type: "DIR_LOADED", path, entries });
        return entries;
      } catch {
        dispatch({ type: "DIR_ERROR", path });
        return [];
      }
    },
    [state.meta, state.treeCache, state.treeState]
  );

  const ensureFile = useCallback(
    async (id: string, path: string) => {
      if (!state.meta) return;
      const meta = state.meta;
      const tab = state.tabs.find((t) => t.id === id);
      if (tab && tab.contentState === "loaded") return;
      dispatch({ type: "FILE_LOADING", id });
      try {
        const { content, size } = await fetchFileContent(
          meta.owner,
          meta.repo,
          path,
          meta.branch
        );
        dispatch({
          type: "FILE_LOADED",
          id,
          content,
          size,
          language: languageFor(path),
        });
      } catch (err) {
        dispatch({
          type: "FILE_ERROR",
          id,
          error: err instanceof Error ? err.message : "Failed to load file.",
        });
      }
    },
    [state.meta, state.tabs]
  );

  const openPath = useCallback(
    (path: string, kind: "file" | "dir", opts?: { newTab?: boolean }) => {
      if (!state.meta) return;
      const meta = state.meta;
      const existing = state.tabs.find(
        (t) => t.path === path && t.repoKey === meta.fullName
      );
      if (existing && !opts?.newTab) {
        dispatch({ type: "SET_ACTIVE", id: existing.id });
        if (kind === "file" && existing.contentState === "idle") {
          void ensureFile(existing.id, path);
        }
        return;
      }
      const tab = emptyTab({
        kind,
        path,
        label: tabLabel(path),
        repoKey: meta.fullName,
        branch: meta.branch,
      });
      dispatch({ type: "ADD_TAB", tab, activate: true });
      if (kind === "file") {
        void ensureFile(tab.id, path);
      } else {
        void ensureDir(path).then((entries) =>
          dispatch({ type: "DIR_ATTACH", id: tab.id, entries })
        );
      }
    },
    [state.meta, state.tabs, ensureDir, ensureFile]
  );

  const openInNewTab = useCallback(
    (path: string, kind: "file" | "dir") => openPath(path, kind, { newTab: true }),
    [openPath]
  );

  const closeTab = useCallback((id: string) => {
    dispatch({ type: "CLOSE_TAB", id });
  }, []);

  const loadFolderTab = useCallback(
    async (id: string, path: string) => {
      const entries = await ensureDir(path);
      dispatch({ type: "DIR_ATTACH", id, entries });
    },
    [ensureDir]
  );

  const setActiveTab = useCallback((id: string) => {
    dispatch({ type: "SET_ACTIVE", id });
    const tab = state.tabs.find((t) => t.id === id);
    if (tab && tab.kind === "file" && tab.contentState === "idle") {
      void ensureFile(id, tab.path);
    } else if (
      tab &&
      tab.kind === "dir" &&
      (tab.entriesState === "idle" || tab.entriesState === "error")
    ) {
      void loadFolderTab(id, tab.path);
    }
  }, [state.tabs, ensureFile, loadFolderTab]);

  const moveTab = useCallback((from: number, to: number) => {
    dispatch({ type: "MOVE_TAB", from, to });
  }, []);

  const toggleExpand = useCallback(
    (path: string, value?: boolean) => {
      const next = value ?? !state.expanded[path];
      dispatch({ type: "SET_EXPANDED", path, value: next });
      if (next) void ensureDir(path);
    },
    [state.expanded, ensureDir]
  );

  const setSelection = useCallback((paths: string[]) => {
    dispatch({ type: "SET_SELECTION", paths });
  }, []);

  const seedDir = useCallback((path: string, entries: GithubEntry[]) => {
    dispatch({ type: "DIR_LOADED", path, entries });
  }, []);

  const invalidateDir = useCallback((path: string) => {
    dispatch({ type: "DIR_INVALIDATE", path });
  }, []);

  const value = useMemo<StoreContextValue>(
    () => ({
      state,
      openRepo,
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
      seedDir,
      invalidateDir,
    }),
    [
      state,
      openRepo,
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
