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
import { DEFAULT_VIEWPORT, type DesktopViewport } from "./geometry";
import { loadSession, saveSession } from "./persistence";
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
} from "./window-state";
import type {
  DesktopIconState,
  DesktopSession,
  OpenWindowInput,
  RubberBandState,
  WindowBounds,
  WindowId,
} from "./types";
const repo = (name: string): DesktopIconState => ({
  id: name.toLowerCase(),
  kind: "repository-drive",
  title: name,
  iconKey: "repo",
  resource: { type: "repository", repoKey: `Lootziffer666/${name}` },
  position: { x: 24, y: name === "ANVIL" ? 76 : 190 },
  selected: false,
  pinned: true,
});
const initialIcons: DesktopIconState[] = [
  repo("ANVIL"),
  repo("SHADED"),
  {
    id: "bin",
    kind: "recycle-bin",
    title: "Recycle Bin",
    iconKey: "bin",
    resource: { type: "system", systemId: "recycle-bin" },
    position: { x: 24, y: 304 },
    selected: false,
    pinned: true,
  },
  {
    id: "settings",
    kind: "settings",
    title: "Settings",
    iconKey: "settings",
    resource: { type: "system", systemId: "settings" },
    position: { x: 24, y: 418 },
    selected: false,
    pinned: true,
  },
];
const base: DesktopSession = {
  windows: [],
  icons: initialIcons,
  rubberBands: [],
  taskbarOrder: [],
  pendingCloseId: null,
  mobileActiveWindowId: null,
};
type API = {
  session: DesktopSession;
  viewport: DesktopViewport;
  openWindow: (i: OpenWindowInput) => void;
  openOrFocusWindow: (i: OpenWindowInput) => void;
  focusWindow: (id: string) => void;
  moveWindow: (id: string, x: number, y: number) => void;
  resizeWindow: (id: string, width: number, height: number) => void;
  minimizeWindow: (id: string) => void;
  restoreWindow: (id: string) => void;
  toggleMinimizeWindow: (id: string) => void;
  maximizeWindow: (id: string) => void;
  restoreMaximizedWindow: (id: string) => void;
  toggleMaximizeWindow: (id: string) => void;
  requestCloseWindow: (id: string) => void;
  confirmCloseWindow: () => void;
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
export function WindowManagerProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState(base);
  const [vp, setVp] = useState(DEFAULT_VIEWPORT);
  const hydrated = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const v = viewport();
    setVp(v);
    let loaded = loadSession(base);
    if (!loaded.windows.length) {
      loaded = openWindowState(
        loaded,
        {
          id: "repo-anvil",
          applicationId: "repository-explorer",
          owner: { type: "desktop" },
          resource: { type: "repository", repoKey: "Lootziffer666/ANVIL" },
          title: "ANVIL — Demo",
          bounds: { x: 150, y: 82, width: 690, height: 510 },
        },
        v,
      );
      loaded = openWindowState(
        loaded,
        {
          id: "repo-shaded",
          applicationId: "repository-explorer",
          owner: { type: "desktop" },
          resource: { type: "repository", repoKey: "Lootziffer666/SHADED" },
          title: "SHADED — Demo",
          bounds: { x: 610, y: 155, width: 680, height: 500 },
        },
        v,
      );
      loaded = openWindowState(
        loaded,
        {
          id: "anvil-image",
          applicationId: "image-viewer",
          owner: childOwner("Lootziffer666/ANVIL", "repo-anvil"),
          resource: {
            type: "file",
            repoKey: "Lootziffer666/ANVIL",
            path: "assets/anvil-mark.svg",
          },
          title: "anvil-mark.svg — Demo",
          bounds: { x: 330, y: 270, width: 520, height: 390 },
        },
        v,
      );
      loaded = openWindowState(
        loaded,
        {
          id: "shaded-actions",
          applicationId: "github-feature",
          owner: childOwner("Lootziffer666/SHADED", "repo-shaded"),
          resource: {
            type: "github-feature",
            repoKey: "Lootziffer666/SHADED",
            featureId: "actions",
          },
          title: "SHADED Actions — Demo",
          bounds: { x: 790, y: 90, width: 500, height: 360 },
        },
        v,
      );
      loaded = openWindowState(
        loaded,
        {
          id: "global-settings",
          applicationId: "system-window",
          owner: { type: "desktop" },
          resource: { type: "system", systemId: "settings" },
          title: "Settings — Demo",
          bounds: { x: 420, y: 180, width: 520, height: 390 },
        },
        v,
      );
      loaded = minimizeWindowState(loaded, "global-settings");
      loaded = openWindowState(
        loaded,
        {
          id: "global-tool",
          applicationId: "tool-window",
          owner: { type: "desktop" },
          resource: { type: "tool", toolId: "scratchpad-unsaved" },
          title: "Scratchpad — Demo",
          bounds: { x: 480, y: 220, width: 490, height: 350 },
        },
        v,
      );
      loaded = minimizeWindowState(loaded, "global-tool");
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
    mutate((s) => openWindowState(s, i, vp));
  const openOrFocusWindow = (i: OpenWindowInput) =>
    mutate((s) => openOrFocusWindowState(s, i, vp));
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
    resizeWindow: (id, width, height) =>
      mutate((s) => ({
        ...s,
        windows: s.windows.map((w) =>
          w.id === id ? { ...w, bounds: { ...w.bounds, width, height } } : w,
        ),
      })),
    minimizeWindow,
    restoreWindow,
    toggleMinimizeWindow: (id) => {
      const w = session.windows.find((x) => x.id === id);
      if (!w) return;
      if (w.state === "minimized") restoreWindow(id);
      else if (
        session.mobileActiveWindowId === id ||
        w.zIndex === Math.max(...session.windows.map((x) => x.zIndex))
      )
        minimizeWindow(id);
      else focusWindow(id);
    },
    maximizeWindow,
    restoreMaximizedWindow,
    toggleMaximizeWindow: (id) =>
      session.windows.find((w) => w.id === id)?.state === "maximized"
        ? restoreMaximizedWindow(id)
        : maximizeWindow(id),
    requestCloseWindow: (id) => mutate((s) => ({ ...s, pendingCloseId: id })),
    confirmCloseWindow: () =>
      mutate((s) => {
        const id = s.pendingCloseId;
        if (!id) return s;
        return {
          ...s,
          windows: s.windows.filter(
            (w) =>
              w.id !== id &&
              !(
                w.owner.type === "repository" &&
                w.owner.repositoryWindowId === id
              ),
          ),
          taskbarOrder: s.taskbarOrder.filter((x) => x !== id),
          pendingCloseId: null,
          mobileActiveWindowId:
            s.mobileActiveWindowId === id ? null : s.mobileActiveWindowId,
        };
      }),
    cancelCloseWindow: () => mutate((s) => ({ ...s, pendingCloseId: null })),
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
      openWindow({
        applicationId,
        owner: childOwner(parent.resource.repoKey, parent.id),
        resource,
        title,
      });
    },
    flushPersistence: () => saveSession(session),
  };
  return <C.Provider value={api}>{children}</C.Provider>;
}
export function useWindowManager() {
  const c = useContext(C);
  if (!c)
    throw new Error("useWindowManager must be inside WindowManagerProvider");
  return c;
}
