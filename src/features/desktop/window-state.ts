import { clampBounds, maximizeBounds, type DesktopViewport } from "./geometry";
import { getApplication } from "./application-registry";
import type {
  DesktopSession,
  DesktopWindowState,
  OpenWindowInput,
  WindowId,
} from "./types";
export function focusWindowState(
  s: DesktopSession,
  id: WindowId,
): DesktopSession {
  const top = Math.max(0, ...s.windows.map((w) => w.zIndex)) + 1;
  return {
    ...s,
    windows: s.windows.map((w) =>
      w.id === id ? { ...w, zIndex: top, lastFocusedAt: Date.now() } : w,
    ),
    activeWindowId: id,
  };
}
export function openWindowState(
  s: DesktopSession,
  input: OpenWindowInput,
  viewport: DesktopViewport,
): DesktopSession {
  const app = getApplication(input.applicationId),
    now = Date.now(),
    n = s.windows.length;
  if (!app.allowMultiple) {
    const existing = s.windows.find(
      (window) => window.applicationId === app.id,
    );
    if (existing) return restoreWindowState(s, existing.id);
  }
  const bounds = clampBounds(
    {
      x: input.bounds?.x ?? 110 + (n % 6) * 34,
      y: input.bounds?.y ?? 90 + (n % 5) * 30,
      width: input.bounds?.width ?? app.defaultSize.width,
      height: input.bounds?.height ?? app.defaultSize.height,
    },
    viewport,
  );
  const w: DesktopWindowState = {
    id: input.id ?? crypto.randomUUID(),
    kind: app.kind,
    applicationId: app.id,
    owner: input.owner,
    resource: input.resource,
    title: input.title ?? app.title,
    iconKey: app.iconKey,
    state: "normal",
    bounds,
    zIndex: Math.max(0, ...s.windows.map((x) => x.zIndex)) + 1,
    groupKey: input.groupKey ?? groupKeyFor(input),
    createdAt: now,
    lastFocusedAt: now,
  };
  return {
    ...s,
    windows: [...s.windows, w],
    taskbarOrder: [...s.taskbarOrder, w.id],
    activeWindowId: w.id,
  };
}
function sameResource(a: DesktopWindowState, input: OpenWindowInput) {
  return (
    a.applicationId === input.applicationId &&
    JSON.stringify(a.resource) === JSON.stringify(input.resource)
  );
}
export function openOrFocusWindowState(
  s: DesktopSession,
  input: OpenWindowInput,
  v: DesktopViewport,
): DesktopSession {
  const found = s.windows.find((w) => sameResource(w, input));
  if (!found) return openWindowState(s, input, v);
  return focusWindowState(
    {
      ...s,
      windows: s.windows.map((w) =>
        w.id === found.id
          ? { ...w, state: w.state === "minimized" ? "normal" : w.state }
          : w,
      ),
    },
    found.id,
  );
}
export function minimizeWindowState(s: DesktopSession, id: string) {
  const windows = s.windows.map((w) =>
    w.id === id ? { ...w, state: "minimized" as const } : w,
  );
  const next =
    s.activeWindowId === id
      ? [...windows]
          .filter((w) => w.state !== "minimized")
          .sort((a, b) => b.zIndex - a.zIndex)[0]
      : undefined;
  return {
    ...s,
    windows: windows.map((w) =>
      w.id === next?.id ? { ...w, lastFocusedAt: Date.now() } : w,
    ),
    activeWindowId:
      s.activeWindowId === id ? (next?.id ?? null) : s.activeWindowId,
  } as DesktopSession;
}
export function restoreWindowState(s: DesktopSession, id: string) {
  return focusWindowState(
    {
      ...s,
      windows: s.windows.map((w) =>
        w.id === id ? { ...w, state: "normal" } : w,
      ),
    },
    id,
  );
}
export function maximizeWindowState(
  s: DesktopSession,
  id: string,
  v: DesktopViewport,
) {
  return focusWindowState(
    {
      ...s,
      windows: s.windows.map((w) =>
        w.id === id && w.state !== "maximized"
          ? {
              ...w,
              state: "maximized",
              restoreBounds: { ...w.bounds },
              bounds: maximizeBounds(v),
            }
          : w,
      ),
    },
    id,
  );
}
export function restoreMaximizedState(s: DesktopSession, id: string) {
  return focusWindowState(
    {
      ...s,
      windows: s.windows.map((w) =>
        w.id === id && w.state === "maximized"
          ? {
              ...w,
              state: "normal",
              bounds: w.restoreBounds ?? w.bounds,
              restoreBounds: undefined,
            }
          : w,
      ),
    },
    id,
  );
}
export function clampSession(s: DesktopSession, v: DesktopViewport) {
  return {
    ...s,
    windows: s.windows.map((w) => ({
      ...w,
      bounds:
        w.state === "maximized" ? maximizeBounds(v) : clampBounds(w.bounds, v),
    })),
  };
}
export function groupTaskbar(windows: DesktopWindowState[]) {
  const groups = new Map<string, DesktopWindowState[]>();
  for (const w of windows) {
    const repoKey =
      w.owner.type === "repository"
        ? w.owner.repoKey
        : w.resource.type === "repository"
          ? w.resource.repoKey
          : null;
    const key = repoKey ? `repository:${repoKey}` : w.groupKey;
    groups.set(key, [...(groups.get(key) ?? []), w]);
  }
  return [...groups.entries()].map(([key, items]) => ({ key, items }));
}
export function closeWindowState(
  s: DesktopSession,
  id: string,
  recycleBinEntries: DesktopSession["recycleBin"] = [],
): DesktopSession {
  const target = s.windows.find((w) => w.id === id);
  if (!target) return s;
  const closingIds = new Set([
    id,
    ...s.windows
      .filter(
        (w) =>
          w.owner.type === "repository" && w.owner.repositoryWindowId === id,
      )
      .map((w) => w.id),
  ]);
  return {
    ...s,
    windows: s.windows.filter((w) => !closingIds.has(w.id)),
    taskbarOrder: s.taskbarOrder.filter((x) => !closingIds.has(x)),
    rubberBands: s.rubberBands.filter(
      (r) => !closingIds.has(r.repositoryWindowId),
    ),
    activeWindowId: nextActiveId(s, closingIds),
    pendingCloseId: null,
    closeContext: null,
    recycleBin: [...s.recycleBin, ...recycleBinEntries],
  };
}
function nextActiveId(s: DesktopSession, excluded = new Set<string>()) {
  return (
    [...s.windows]
      .filter((w) => !excluded.has(w.id) && w.state !== "minimized")
      .sort((a, b) => b.zIndex - a.zIndex)[0]?.id ?? null
  );
}
export function childOwner(repoKey: string, repositoryWindowId: string) {
  return { type: "repository" as const, repoKey, repositoryWindowId };
}
export function mobileVisibleWindow(s: DesktopSession) {
  const active = s.windows.find(
    (w) => w.id === s.activeWindowId && w.state !== "minimized",
  );
  return (
    active ??
    [...s.windows]
      .filter((w) => w.state !== "minimized")
      .sort((a, b) => b.zIndex - a.zIndex)[0] ??
    null
  );
}
function groupKeyFor(input: OpenWindowInput) {
  if (input.owner.type === "repository") return input.owner.repoKey;
  if (input.resource.type === "repository") return input.resource.repoKey;
  return "system";
}
