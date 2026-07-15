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
  | { type: "ADD_TAB"; tab: Tab; activate: boolean; dedupe?: boolean }
  | { type: "CLOSE_TAB"; repoKey: string; id: string }
  | { type: "SET_ACTIVE"; repoKey: string; id: string }
  | { type: "MOVE_TAB"; repoKey: string; from: number; to: number }
  | { type: "DIR_LOADING"; repoKey: string; branch: string; path: string }
  | {
      type: "DIR_LOADED";
      repoKey: string;
      branch: string;
      path: string;
      entries: GithubEntry[];
    }
  | { type: "DIR_ERROR"; repoKey: string; branch: string; path: string }
  | { type: "DIR_INVALIDATE"; repoKey: string; path: string }
  | {
      type: "DIR_ATTACH";
      repoKey: string;
      branch: string;
      id: string;
      entries: GithubEntry[];
    }
  | { type: "FILE_LOADING"; repoKey: string; branch: string; id: string }
  | {
      type: "FILE_LOADED";
      repoKey: string;
      branch: string;
      id: string;
      content: string;
      language: string;
      size: number;
    }
  | {
      type: "FILE_ERROR";
      repoKey: string;
      branch: string;
      id: string;
      error: string;
    }
  | { type: "SET_EXPANDED"; repoKey: string; path: string; value: boolean }
  | { type: "SET_SELECTION"; repoKey: string; paths: string[] }
  | { type: "SET_BRANCH"; repoKey: string; branch: string };

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
  repos: {},
  activeRepoKey: null,
  pinnedRepoKeys: [],
  recent: [],
  repoError: null,
  repoLoading: false,
};

function updateRepo(
  state: State,
  repoKey: string,
  update: (repo: RepoState) => RepoState
): State {
  const repo = state.repos[repoKey];
  if (!repo) return state;

  return {
    ...state,
    repos: {
      ...state.repos,
      [repoKey]: update(repo),
    },
  };
}

function updateRepoBranch(
  state: State,
  repoKey: string,
  branch: string,
  update: (repo: RepoState) => RepoState
): State {
  return updateRepo(state, repoKey, (repo) => {
    if (repo.meta.branch !== branch) return repo;
    return update(repo);
  });
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "REPO_LOADING":
      return { ...state, repoLoading: true, repoError: null };

    case "REPO_LOADED": {
      const repoKey = action.meta.fullName;
      const existing = state.repos[repoKey];
      const repo = existing
        ? {
            ...existing,
            meta: {
              ...existing.meta,
              ...action.meta,
              branch: existing.meta.branch,
            },
          }
        : emptyRepo(action.meta);

      return {
        ...state,
        repoLoading: false,
        repoError: null,
        activeRepoKey: repoKey,
        repos: {
          ...state.repos,
          [repoKey]: repo,
        },
        recent: state.recent.includes(repoKey)
          ? state.recent
          : [repoKey, ...state.recent].slice(0, 8),
      };
    }

    case "REPO_ERROR":
      return { ...state, repoLoading: false, repoError: action.error };

    case "CLOSE_REPO":
      return {
        ...state,
        activeRepoKey: null,
        repoError: null,
        repoLoading: false,
      };

    case "SWITCH_REPO":
      return state.repos[action.repoKey]
        ? { ...state, activeRepoKey: action.repoKey }
        : state;

    case "ADD_TAB":
      return updateRepo(state, action.tab.repoKey, (repo) => {
        if (action.dedupe) {
          const existing = repo.tabs.find(
            (tab) =>
              tab.kind === action.tab.kind &&
              tab.path === action.tab.path &&
              tab.branch === action.tab.branch
          );
          if (existing) {
            return {
              ...repo,
              activeTabId: action.activate ? existing.id : repo.activeTabId,
            };
          }
        }

        return {
          ...repo,
          tabs: [...repo.tabs, action.tab],
          activeTabId: action.activate ? action.tab.id : repo.activeTabId,
        };
      });

    case "CLOSE_TAB":
      return updateRepo(state, action.repoKey, (repo) => {
        const index = repo.tabs.findIndex((tab) => tab.id === action.id);
        if (index === -1) return repo;

        const tabs = repo.tabs.filter((tab) => tab.id !== action.id);
        let activeTabId = repo.activeTabId;
        if (repo.activeTabId === action.id) {
          activeTabId = tabs[Math.min(index, tabs.length - 1)]?.id ?? null;
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
        ) {
          return repo;
        }

        const tabs = [...repo.tabs];
        const [moved] = tabs.splice(action.from, 1);
        tabs.splice(action.to, 0, moved);
        return { ...repo, tabs };
      });

    case "DIR_LOADING":
      return updateRepoBranch(state, action.repoKey, action.branch, (repo) => ({
        ...repo,
        treeState: { ...repo.treeState, [action.path]: "loading" },
      }));

    case "DIR_LOADED":
      return updateRepoBranch(state, action.repoKey, action.branch, (repo) => ({
        ...repo,
        treeCache: { ...repo.treeCache, [action.path]: action.entries },
        treeState: { ...repo.treeState, [action.path]: "loaded" },
      }));

    case "DIR_ERROR":
      return updateRepoBranch(state, action.repoKey, action.branch, (repo) => ({
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
      return updateRepoBranch(state, action.repoKey, action.branch, (repo) => ({
        ...repo,
        tabs: repo.tabs.map((tab) =>
          tab.id === action.id
            ? {
                ...tab,
                entries: action.entries,
                entriesState: "loaded",
                entriesError: undefined,
              }
            : tab
        ),
      }));

    case "FILE_LOADING":
      return updateRepoBranch(state, action.repoKey, action.branch, (repo) => ({
        ...repo,
        tabs: repo.tabs.map((tab) =>
          tab.id === action.id ? { ...tab, contentState: "loading" } : tab
        ),
      }));

    case "FILE_LOADED":
      return updateRepoBranch(state, action.repoKey, action.branch, (repo) => ({
        ...repo,
        tabs: repo.tabs.map((tab) =>
          tab.id === action.id
            ? {
                ...tab,
                content: action.content,
                language: action.language,
                size: action.size,
                contentState: "loaded",
                contentError: undefined,
              }
            : tab
        ),
      }));

    case "FILE_ERROR":
      return updateRepoBranch(state, action.repoKey, action.branch, (repo) => ({
        ...repo,
        tabs: repo.tabs.map((tab) =>
          tab.id === action.id
            ? {
                ...tab,
                contentState: "error",
                contentError: action.error,
              }
            : tab
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
      return updateRepo(state, action.repoKey, (repo) =>
        emptyRepo({ ...repo.meta, branch: action.branch })
      );

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
  const activeRepo = state.activeRepoKey
    ? state.repos[state.activeRepoKey] ?? null
    : null;

  const loadRoot = useCallback(async (meta: RepoMeta) => {
    const repoKey = meta.fullName;
    const branch = meta.branch;

    try {
      const root = await fetchContents(meta.owner, meta.repo, "", branch);
      dispatch({ type: "DIR_LOADED", repoKey, branch, path: "", entries: root });
      return root;
    } catch {
      dispatch({ type: "DIR_ERROR", repoKey, branch, path: "" });
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

      dispatch({ type: "REPO_LOADING" });

      try {
        const meta = await fetchRepoMeta(parsed.owner, parsed.repo);
        const repoKey = meta.fullName;
        const existed = Boolean(state.repos[repoKey]);

        dispatch({ type: "REPO_LOADED", meta });

        if (!existed) {
          const root = await loadRoot(meta);
          dispatch({
            type: "ADD_TAB",
            activate: true,
            dedupe: true,
            tab: emptyTab({
              kind: "dir",
              path: "",
              label: meta.fullName,
              repoKey,
              branch: meta.branch,
              entries: root,
              entriesState: "loaded",
            }),
          });
        }

        try {
          const stored = JSON.parse(
            localStorage.getItem("gh-browser-recent") ?? "[]"
          );
          const recent = [
            repoKey,
            ...stored.filter((entry: string) => entry !== repoKey),
          ].slice(0, 8);
          localStorage.setItem("gh-browser-recent", JSON.stringify(recent));
        } catch {
          // Recent repositories are a convenience; storage failure is non-fatal.
        }
      } catch (error) {
        dispatch({
          type: "REPO_ERROR",
          error:
            error instanceof Error ? error.message : "Failed to load repository.",
        });
      }
    },
    [loadRoot, state.repos]
  );

  const closeRepo = useCallback(() => {
    dispatch({ type: "CLOSE_REPO" });
  }, []);

  const switchRepo = useCallback((repoKey: string) => {
    dispatch({ type: "SWITCH_REPO", repoKey });
  }, []);

  const setBranch = useCallback(
    (branch: string) => {
      if (!activeRepo) return;

      const repoKey = activeRepo.meta.fullName;
      const owner = activeRepo.meta.owner;
      const repo = activeRepo.meta.repo;

      dispatch({ type: "SET_BRANCH", repoKey, branch });
      fetchContents(owner, repo, "", branch)
        .then((root) =>
          dispatch({
            type: "DIR_LOADED",
            repoKey,
            branch,
            path: "",
            entries: root,
          })
        )
        .catch(() =>
          dispatch({ type: "DIR_ERROR", repoKey, branch, path: "" })
        );
    },
    [activeRepo]
  );

  const ensureDir = useCallback(
    async (path: string): Promise<GithubEntry[]> => {
      if (!activeRepo) return [];

      if (
        activeRepo.treeCache[path] &&
        activeRepo.treeState[path] === "loaded"
      ) {
        return activeRepo.treeCache[path];
      }

      const repoKey = activeRepo.meta.fullName;
      const branch = activeRepo.meta.branch;
      const owner = activeRepo.meta.owner;
      const repo = activeRepo.meta.repo;

      dispatch({ type: "DIR_LOADING", repoKey, branch, path });

      try {
        const entries = await fetchContents(owner, repo, path, branch);
        dispatch({ type: "DIR_LOADED", repoKey, branch, path, entries });
        return entries;
      } catch {
        dispatch({ type: "DIR_ERROR", repoKey, branch, path });
        return [];
      }
    },
    [activeRepo]
  );

  const ensureFile = useCallback(
    async (id: string, path: string) => {
      if (!activeRepo) return;

      const tab = activeRepo.tabs.find((candidate) => candidate.id === id);
      if (tab?.contentState === "loaded") return;

      const repoKey = activeRepo.meta.fullName;
      const branch = activeRepo.meta.branch;
      const owner = activeRepo.meta.owner;
      const repo = activeRepo.meta.repo;

      dispatch({ type: "FILE_LOADING", repoKey, branch, id });

      try {
        const { content, size } = await fetchFileContent(
          owner,
          repo,
          path,
          branch
        );
        dispatch({
          type: "FILE_LOADED",
          repoKey,
          branch,
          id,
          content,
          size,
          language: languageFor(path),
        });
      } catch (error) {
        dispatch({
          type: "FILE_ERROR",
          repoKey,
          branch,
          id,
          error: error instanceof Error ? error.message : "Failed to load file.",
        });
      }
    },
    [activeRepo]
  );

  const openPath = useCallback(
    (path: string, kind: "file" | "dir", opts?: { newTab?: boolean }) => {
      if (!activeRepo) return;

      const repoKey = activeRepo.meta.fullName;
      const branch = activeRepo.meta.branch;
      const existing = activeRepo.tabs.find(
        (tab) => tab.path === path && tab.repoKey === repoKey
      );

      if (existing && !opts?.newTab) {
        dispatch({ type: "SET_ACTIVE", repoKey, id: existing.id });
        if (kind === "file" && existing.contentState === "idle") {
          void ensureFile(existing.id, path);
        }
        return;
      }

      const tab = emptyTab({
        kind,
        path,
        label: tabLabel(path),
        repoKey,
        branch,
      });

      dispatch({ type: "ADD_TAB", tab, activate: true });

      if (kind === "file") {
        void ensureFile(tab.id, path);
      } else {
        void ensureDir(path).then((entries) =>
          dispatch({
            type: "DIR_ATTACH",
            repoKey,
            branch,
            id: tab.id,
            entries,
          })
        );
      }
    },
    [activeRepo, ensureDir, ensureFile]
  );

  const openInNewTab = useCallback(
    (path: string, kind: "file" | "dir") =>
      openPath(path, kind, { newTab: true }),
    [openPath]
  );

  const closeTab = useCallback(
    (id: string) => {
      if (!activeRepo) return;
      dispatch({ type: "CLOSE_TAB", repoKey: activeRepo.meta.fullName, id });
    },
    [activeRepo]
  );

  const loadFolderTab = useCallback(
    async (id: string, path: string) => {
      if (!activeRepo) return;

      const repoKey = activeRepo.meta.fullName;
      const branch = activeRepo.meta.branch;
      const entries = await ensureDir(path);

      dispatch({ type: "DIR_ATTACH", repoKey, branch, id, entries });
    },
    [activeRepo, ensureDir]
  );

  const setActiveTab = useCallback(
    (id: string) => {
      if (!activeRepo) return;

      const repoKey = activeRepo.meta.fullName;
      dispatch({ type: "SET_ACTIVE", repoKey, id });

      const tab = activeRepo.tabs.find((candidate) => candidate.id === id);
      if (tab?.kind === "file" && tab.contentState === "idle") {
        void ensureFile(id, tab.path);
      } else if (
        tab?.kind === "dir" &&
        (tab.entriesState === "idle" || tab.entriesState === "error")
      ) {
        void loadFolderTab(id, tab.path);
      }
    },
    [activeRepo, ensureFile, loadFolderTab]
  );

  const moveTab = useCallback(
    (from: number, to: number) => {
      if (!activeRepo) return;
      dispatch({
        type: "MOVE_TAB",
        repoKey: activeRepo.meta.fullName,
        from,
        to,
      });
    },
    [activeRepo]
  );

  const toggleExpand = useCallback(
    (path: string, value?: boolean) => {
      if (!activeRepo) return;

      const repoKey = activeRepo.meta.fullName;
      const next = value ?? !activeRepo.expanded[path];
      dispatch({ type: "SET_EXPANDED", repoKey, path, value: next });
      if (next) void ensureDir(path);
    },
    [activeRepo, ensureDir]
  );

  const setSelection = useCallback(
    (paths: string[]) => {
      if (!activeRepo) return;
      dispatch({
        type: "SET_SELECTION",
        repoKey: activeRepo.meta.fullName,
        paths,
      });
    },
    [activeRepo]
  );

  const seedDir = useCallback(
    (path: string, entries: GithubEntry[]) => {
      if (!activeRepo) return;
      dispatch({
        type: "DIR_LOADED",
        repoKey: activeRepo.meta.fullName,
        branch: activeRepo.meta.branch,
        path,
        entries,
      });
    },
    [activeRepo]
  );

  const invalidateDir = useCallback(
    (path: string) => {
      if (!activeRepo) return;
      dispatch({
        type: "DIR_INVALIDATE",
        repoKey: activeRepo.meta.fullName,
        path,
      });
    },
    [activeRepo]
  );

  const value = useMemo<StoreContextValue>(
    () => ({
      state,
      activeRepo,
      openRepo,
      closeRepo,
      switchRepo,
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
      activeRepo,
      openRepo,
      closeRepo,
      switchRepo,
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
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore must be used within StoreProvider");
  return context;
}

export function useActiveRepo(): RepoState | null {
  return useStore().activeRepo;
}
