"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_VIEWPORT,
  resizeBounds,
  type DesktopViewport,
  type ResizeDirection,
} from "./geometry";
import { loadSession, saveSession } from "./persistence";
import { getApplication } from "./application-registry";
import {
  applyCloseResolutionFailure,
  applyCloseResolutionPending,
  canResolveClose,
} from "./lifecycle";
import {
  childOwner,
  clampSession,
  focusWindowState,
  maximizeWindowState,
  minimizeWindowState,
  openOrFocusWindowState,
  openWindowState,
  restoreMaximizedState,
  restoreWindowState,
  closeWindowState,
} from "./window-state";
import type {
  DesktopIconState,
  DesktopSession,
  OpenWindowInput,
  RubberBandState,
  WindowBounds,
  WindowId,
  WindowCloseResolution,
  WindowLifecycleAdapter,
  RecycleBinLifecycleAdapter,
} from "./types";
// Recycle Bin and Settings are deliberately not seeded as generic desktop
// icons (native workspace redesign) — both stay one click away via the
// launcher's tool grid instead of sitting on the desktop as decorative
// Windows-95-style icons. Repository drives remain the only default icons,
// since a repository IS a docked workspace, not a shortcut to one.
const initialIcons: DesktopIconState[] = [];
/** Icon slot for the next repository drive (below the system icons). */
function nextIconPosition(icons: DesktopIconState[]) {
  const used = icons.map((i) => i.position.y).filter((y) => y >= 0);
  const y = 76 + icons.length * 114;
  return { x: 24, y: Math.max(304, used.length ? Math.max(...used) + 114 : y) };
}
function repositoryIcon(
  repoKey: string,
  icons: DesktopIconState[],
): DesktopIconState {
  return {
    id: `repo:${repoKey.toLowerCase()}`,
    kind: "repository-drive",
    title: repoKey.split("/").pop() ?? repoKey,
    iconKey: "repo",
    resource: { type: "repository", repoKey },
    position: nextIconPosition(icons),
    selected: false,
    pinned: true,
  };
}
/** Adds a desktop drive icon for a repository if none exists yet. */
function ensureRepositoryIcon(
  s: DesktopSession,
  repoKey: string,
): DesktopSession {
  const exists = s.icons.some(
    (i) =>
      i.resource?.type === "repository" &&
      i.resource.repoKey.toLowerCase() === repoKey.toLowerCase(),
  );
  if (exists) return s;
  return { ...s, icons: [...s.icons, repositoryIcon(repoKey, s.icons)] };
}
const base: DesktopSession = {
  windows: [],
  icons: initialIcons,
  rubberBands: [],
  taskbarOrder: [],
  pendingCloseId: null,
  activeWindowId: null,
  closeContext: null,
  recycleBin: [],
  restoredItems: [],
  recycleError: null,
};
/** Fallback adapter when no domain lifecycle is injected: closes cleanly. */
const cleanLifecycle: WindowLifecycleAdapter & RecycleBinLifecycleAdapter = {
  async inspectClose() {
    return [];
  },
  async resolveClose(_context, resolution) {
    return { success: resolution.action !== "cancel" };
  },
  async restoreEntry() {
    return { success: true };
  },
};
type API = {
  session: DesktopSession;
  viewport: DesktopViewport;
  openWindow: (i: OpenWindowInput) => void;
  openOrFocusWindow: (i: OpenWindowInput) => void;
  focusWindow: (id: string) => void;
  moveWindow: (id: string, x: number, y: number) => void;
  resizeWindow: (
    id: string,
    direction: ResizeDirection,
    deltaX: number,
    deltaY: number,
    original: WindowBounds,
  ) => void;
  minimizeWindow: (id: string) => void;
  restoreWindow: (id: string) => void;
  toggleMinimizeWindow: (id: string) => void;
  maximizeWindow: (id: string) => void;
  restoreMaximizedWindow: (id: string) => void;
  toggleMaximizeWindow: (id: string) => void;
  requestCloseWindow: (id: string) => void;
  resolveCloseWindow: (resolution: WindowCloseResolution) => Promise<void>;
  retryCloseInspection: () => Promise<void>;
  cancelCloseWindow: () => void;
  setTaskbarOrder: (ids: string[]) => void;
  restoreDesktopSession: () => void;
  resetDesktopSession: () => void;
  selectIcons: (ids: string[], additive?: boolean) => void;
  moveIcon: (id: string, x: number, y: number) => void;
  setRubberBand: (r: RubberBandState) => void;
  openRepositoryChild: (
    parentId: string,
    applicationId: string,
    resource: OpenWindowInput["resource"],
    title: string,
  ) => void;
  flushPersistence: () => void;
  restoreRecycleEntry: (id: string) => void;
  deleteRecycleEntry: (id: string) => void;
  emptyRecycleBin: () => void;
};
const C = createContext<API | null>(null);
function viewport(): DesktopViewport {
  return typeof window === "undefined"
    ? DEFAULT_VIEWPORT
    : {
        width: window.innerWidth,
        height: window.innerHeight,
        systemBarHeight: 46,
        taskbarHeight: 78,
      };
}
export function WindowManagerProvider({
  children,
  lifecycle,
}: {
  children: ReactNode;
  /** Domain lifecycle adapter for close inspection/resolution and
   * Recycle-Bin restore. Defaults to a clean-close adapter. */
  lifecycle?: WindowLifecycleAdapter & RecycleBinLifecycleAdapter;
}) {
  const adapter = lifecycle ?? cleanLifecycle;
  const adapterRef = useRef(adapter);
  adapterRef.current = adapter;
  const [session, setSession] = useState(base);
  const [vp, setVp] = useState(DEFAULT_VIEWPORT);
  const hydrated = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resolvingClose = useRef<string | null>(null);
  useEffect(() => {
    const v = viewport();
    setVp(v);
    let loaded = loadSession(base);
    // First run (no persisted session): surface recently used repositories
    // as desktop drives. No windows are force-opened.
    if (!loaded.windows.length && !loaded.icons.some((i) => i.kind === "repository-drive")) {
      try {
        const recent: string[] = JSON.parse(
          localStorage.getItem("gh-browser-recent") ?? "[]",
        );
        for (const repoKey of recent.slice(0, 4)) {
          loaded = ensureRepositoryIcon(loaded, repoKey);
        }
      } catch {
        /* ignore */
      }
    }
    setSession(loaded);
    hydrated.current = true;
  }, []);
  useEffect(() => {
    const on = () => {
      const v = viewport();
      setVp(v);
      setSession((s) => clampSession(s, v));
    };
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  useEffect(() => {
    if (!hydrated.current) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => saveSession(session), 350);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [session]);
  const mutate = (fn: (s: DesktopSession) => DesktopSession) => setSession(fn);
  const openWindow = (i: OpenWindowInput) =>
    mutate((s) =>
      i.resource.type === "repository"
        ? ensureRepositoryIcon(openWindowState(s, i, vp), i.resource.repoKey)
        : openWindowState(s, i, vp),
    );
  const openOrFocusWindow = (i: OpenWindowInput) =>
    mutate((s) =>
      i.resource.type === "repository"
        ? ensureRepositoryIcon(
            openOrFocusWindowState(s, i, vp),
            i.resource.repoKey,
          )
        : openOrFocusWindowState(s, i, vp),
    );
  const focusWindow = (id: string) => mutate((s) => focusWindowState(s, id));
  const minimizeWindow = (id: string) =>
    mutate((s) => minimizeWindowState(s, id));
  const restoreWindow = (id: string) =>
    mutate((s) => restoreWindowState(s, id));
  const maximizeWindow = (id: string) =>
    mutate((s) => maximizeWindowState(s, id, vp));
  const restoreMaximizedWindow = (id: string) =>
    mutate((s) => restoreMaximizedState(s, id));
  const api: API = {
    session,
    viewport: vp,
    openWindow,
    openOrFocusWindow,
    focusWindow,
    moveWindow: (id, x, y) =>
      mutate((s) =>
        clampSession(
          {
            ...s,
            windows: s.windows.map((w) =>
              w.id === id ? { ...w, bounds: { ...w.bounds, x, y } } : w,
            ),
          },
          vp,
        ),
      ),
    resizeWindow: (id, direction, deltaX, deltaY, original) =>
      mutate((s) => ({
        ...s,
        windows: s.windows.map((w) => {
          if (w.id !== id) return w;
          const app = getApplication(w.applicationId);
          return {
            ...w,
            bounds: resizeBounds(
              original,
              direction,
              deltaX,
              deltaY,
              app.minimumSize,
              vp,
            ),
          };
        }),
      })),
    minimizeWindow,
    restoreWindow,
    toggleMinimizeWindow: (id) => {
      const w = session.windows.find((x) => x.id === id);
      if (!w) return;
      if (w.minimized) restoreWindow(id);
      else if (
        session.activeWindowId === id ||
        w.zIndex === Math.max(...session.windows.map((x) => x.zIndex))
      )
        minimizeWindow(id);
      else focusWindow(id);
    },
    maximizeWindow,
    restoreMaximizedWindow,
    toggleMaximizeWindow: (id) =>
      session.windows.find((w) => w.id === id)?.presentation === "maximized"
        ? restoreMaximizedWindow(id)
        : maximizeWindow(id),
    requestCloseWindow: async (id) => {
      const target = session.windows.find((w) => w.id === id);
      if (!target) return;
      const children = session.windows.filter(
        (w) =>
          w.owner.type === "repository" && w.owner.repositoryWindowId === id,
      );
      const partial = {
        transactionId: crypto.randomUUID(),
        target,
        children,
        reason: "user-request" as const,
      };
      mutate((s) => ({
        ...s,
        pendingCloseId: id,
        closeContext: {
          ...partial,
          blockers: [],
          inspectionStatus: "pending",
          resolutionStatus: "idle",
        },
      }));
      try {
        const blockers = await adapterRef.current.inspectClose(partial);
        mutate((s) =>
          s.closeContext?.transactionId === partial.transactionId
            ? {
                ...s,
                closeContext: {
                  ...partial,
                  blockers,
                  inspectionStatus: "ready",
                  resolutionStatus: "idle",
                },
              }
            : s,
        );
      } catch (error) {
        mutate((s) =>
          s.closeContext?.transactionId === partial.transactionId
            ? {
                ...s,
                closeContext: {
                  ...s.closeContext,
                  inspectionStatus: "failed",
                  error:
                    error instanceof Error
                      ? error.message
                      : "Close inspection failed",
                },
              }
            : s,
        );
      }
    },
    resolveCloseWindow: async (resolution) => {
      const context = session.closeContext;
      if (!context) return;
      if (!canResolveClose(context, resolution)) return;
      if (resolution.action === "cancel") {
        mutate((s) => ({ ...s, pendingCloseId: null, closeContext: null }));
        return;
      }
      if (resolvingClose.current === context.transactionId) return;
      resolvingClose.current = context.transactionId;
      mutate((s) => applyCloseResolutionPending(s, context.transactionId));
      try {
        const result = await adapterRef.current.resolveClose(context, resolution);
        setSession((current) => {
          if (current.closeContext?.transactionId !== context.transactionId)
            return current;
          if (!result.success)
            return applyCloseResolutionFailure(
              current,
              context.transactionId,
              result.error ?? "Close resolution failed",
            );
          return closeWindowState(
            current,
            context.target.id,
            result.recycleBinEntries ?? [],
          );
        });
      } catch (error) {
        setSession((current) =>
          applyCloseResolutionFailure(
            current,
            context.transactionId,
            error instanceof Error ? error.message : "Close resolution failed",
          ),
        );
      } finally {
        if (resolvingClose.current === context.transactionId)
          resolvingClose.current = null;
      }
    },
    retryCloseInspection: async () => {
      const current = session.closeContext;
      if (!current || current.inspectionStatus !== "failed") return;
      const transactionId = crypto.randomUUID();
      const partial = {
        transactionId,
        target: current.target,
        children: current.children,
        reason: current.reason,
      };
      mutate((s) => ({
        ...s,
        pendingCloseId: current.target.id,
        closeContext: {
          ...partial,
          blockers: [],
          inspectionStatus: "pending",
          resolutionStatus: "idle",
        },
      }));
      try {
        const blockers = await adapterRef.current.inspectClose(partial);
        mutate((s) =>
          s.closeContext?.transactionId === transactionId
            ? {
                ...s,
                closeContext: {
                  ...partial,
                  blockers,
                  inspectionStatus: "ready",
                  resolutionStatus: "idle",
                },
              }
            : s,
        );
      } catch (error) {
        mutate((s) =>
          s.closeContext?.transactionId === transactionId
            ? {
                ...s,
                closeContext: {
                  ...s.closeContext,
                  inspectionStatus: "failed",
                  error:
                    error instanceof Error
                      ? error.message
                      : "Close inspection failed",
                },
              }
            : s,
        );
      }
    },
    cancelCloseWindow: () =>
      mutate((s) => ({ ...s, pendingCloseId: null, closeContext: null })),
    setTaskbarOrder: (ids) => mutate((s) => ({ ...s, taskbarOrder: ids })),
    restoreDesktopSession: () => setSession(loadSession(base)),
    resetDesktopSession: () => setSession(base),
    selectIcons: (ids, additive = false) =>
      mutate((s) => ({
        ...s,
        icons: s.icons.map((i) => ({
          ...i,
          selected: ids.includes(i.id) || (additive && i.selected),
        })),
      })),
    moveIcon: (id, x, y) =>
      mutate((s) => ({
        ...s,
        icons: s.icons.map((i) =>
          i.id === id ? { ...i, position: { x, y } } : i,
        ),
      })),
    setRubberBand: (r) =>
      mutate((s) => ({
        ...s,
        rubberBands: [
          ...s.rubberBands.filter(
            (x) => x.repositoryWindowId !== r.repositoryWindowId,
          ),
          r,
        ],
      })),
    openRepositoryChild: (parentId, applicationId, resource, title) => {
      const parent = session.windows.find((w) => w.id === parentId);
      if (!parent || parent.resource.type !== "repository") return;
      openOrFocusWindow({
        applicationId,
        owner: childOwner(parent.resource.repoKey, parent.id),
        resource,
        title,
      });
    },
    flushPersistence: () => saveSession(session),
    restoreRecycleEntry: async (id) => {
      const entry = session.recycleBin.find((e) => e.id === id);
      if (!entry) return;
      const result = await adapterRef.current.restoreEntry(entry);
      mutate((s) =>
        result.success
          ? {
              ...s,
              recycleBin: s.recycleBin.filter((e) => e.id !== id),
              restoredItems: [
                ...s.restoredItems,
                { id: entry.id, label: entry.label, restoredAt: Date.now() },
              ],
              recycleError: null,
            }
          : { ...s, recycleError: result.error ?? "Restore failed" },
      );
    },
    deleteRecycleEntry: (id) =>
      mutate((s) => ({
        ...s,
        recycleBin: s.recycleBin.filter((e) => e.id !== id),
      })),
    emptyRecycleBin: () => mutate((s) => ({ ...s, recycleBin: [] })),
  };
  return <C.Provider value={api}>{children}</C.Provider>;
}
export function useWindowManager() {
  const c = useContext(C);
  if (!c)
    throw new Error("useWindowManager must be inside WindowManagerProvider");
  return c;
}
