import type { DesktopSession } from "./types";
export const DESKTOP_STORAGE_KEY = "draghub.desktop.session";
export const DESKTOP_SESSION_VERSION = 5;
type Envelope = { version: number; session: DesktopSession };
export function serializeSession(session: DesktopSession) {
  return JSON.stringify({
    version: DESKTOP_SESSION_VERSION,
    session,
  } satisfies Envelope);
}
export function migratePersistedSession(
  value: unknown,
  fallback: DesktopSession,
): DesktopSession {
  if (!value || typeof value !== "object") return fallback;
  const data = value as Partial<Envelope>;
  if (data.version === 5 && isSession(data.session))
    return sanitizeDesktopSession(data.session, fallback);
  if (data.version === 4 && isSession(data.session))
    return sanitizeDesktopSession(
      {
        ...data.session,
        windows: data.session.windows.map((window) => {
          const old = window as typeof window & { state?: string };
          return {
            ...window,
            presentation:
              old.state === "maximized"
                ? ("maximized" as const)
                : ("normal" as const),
            minimized: old.state === "minimized",
          };
        }),
        pendingCloseId: null,
        activeWindowId: data.session.activeWindowId ?? null,
        closeContext: null,
        recycleBin: data.session.recycleBin ?? [],
        restoredItems: data.session.restoredItems ?? [],
        recycleError: null,
      },
      fallback,
    );
  if ([1, 2, 3].includes(data.version ?? 0) && isSession(data.session))
    return sanitizeDesktopSession(
      {
        ...data.session,
        windows: data.session.windows.map((window) => {
          const old = window as typeof window & { state?: string };
          return {
            ...window,
            presentation:
              old.state === "maximized"
                ? ("maximized" as const)
                : ("normal" as const),
            minimized: old.state === "minimized",
          };
        }),
        pendingCloseId: null,
        closeContext: null,
        recycleBin: [],
        restoredItems: [],
        recycleError: null,
      },
      fallback,
    );
  return fallback;
}
const applications = new Set([
  "repository-explorer",
  "image-viewer",
  "file-editor",
  "github-feature",
  "tool-window",
  "settings",
  "recycle-bin",
]);
export function sanitizeDesktopSession(
  session: DesktopSession,
  fallback: DesktopSession,
): DesktopSession {
  const validPresentation = (x: unknown) => x === "normal" || x === "maximized";
  const validBounds = (b: unknown) =>
    !!b &&
    typeof b === "object" &&
    ["x", "y", "width", "height"].every((k) =>
      Number.isFinite((b as Record<string, unknown>)[k]),
    );
  const validResource = (r: unknown) => {
    if (!r || typeof r !== "object") return false;
    const x = r as Record<string, unknown>;
    switch (x.type) {
      case "repository":
        return typeof x.repoKey === "string";
      case "file":
        return typeof x.repoKey === "string" && typeof x.path === "string";
      case "github-feature":
        return typeof x.repoKey === "string" && typeof x.featureId === "string";
      case "tool":
        return typeof x.toolId === "string";
      case "system":
        return typeof x.systemId === "string";
      default:
        return false;
    }
  };
  const validOwner = (o: unknown) =>
    !!o &&
    typeof o === "object" &&
    ((o as { type?: unknown }).type === "desktop" ||
      ((o as { type?: unknown }).type === "repository" &&
        typeof (o as { repoKey?: unknown }).repoKey === "string" &&
        typeof (o as { repositoryWindowId?: unknown }).repositoryWindowId ===
          "string"));
  const initiallyValid = session.windows.filter(
    (w) =>
      applications.has(w.applicationId) &&
      validPresentation(w.presentation) &&
      typeof w.minimized === "boolean" &&
      validBounds(w.bounds) &&
      validOwner(w.owner) &&
      validResource(w.resource),
  );
  const repositoryParents = new Map(
    initiallyValid
      .filter(
        (w) =>
          w.applicationId === "repository-explorer" &&
          w.resource.type === "repository" &&
          w.owner.type === "desktop",
      )
      .map((w) => [
        w.id,
        w.resource.type === "repository" ? w.resource.repoKey : "",
      ]),
  );
  const windows = initiallyValid.filter(
    (w) =>
      w.owner.type === "desktop" ||
      repositoryParents.get(w.owner.repositoryWindowId) === w.owner.repoKey,
  );
  const ids = new Set(windows.map((w) => w.id));
  const repoIds = new Set(
    windows.filter((w) => w.resource.type === "repository").map((w) => w.id),
  );
  return {
    ...fallback,
    ...session,
    windows,
    taskbarOrder: session.taskbarOrder.filter((id) => ids.has(id)),
    rubberBands: session.rubberBands.filter((r) =>
      repoIds.has(r.repositoryWindowId),
    ),
    activeWindowId: (() => {
      const requested = windows.find(
        (w) => w.id === session.activeWindowId && !w.minimized,
      );
      return (
        requested?.id ??
        [...windows]
          .filter((w) => !w.minimized)
          .sort((a, b) => b.zIndex - a.zIndex)[0]?.id ??
        null
      );
    })(),
    pendingCloseId: null,
    closeContext: null,
    recycleBin: Array.isArray(session.recycleBin)
      ? session.recycleBin.filter(validRecycleEntry)
      : [],
    restoredItems: Array.isArray(session.restoredItems)
      ? session.restoredItems
      : [],
    recycleError: null,
  };
}
function validRecycleEntry(entry: unknown) {
  if (!entry || typeof entry !== "object") return false;
  const e = entry as Record<string, unknown>;
  if (
    typeof e.id !== "string" ||
    typeof e.sourceWindowId !== "string" ||
    !Number.isFinite(e.discardedAt) ||
    typeof e.label !== "string" ||
    !e.payload ||
    typeof e.payload !== "object"
  )
    return false;
  if (e.kind === "draft")
    return typeof (e.payload as Record<string, unknown>).content === "string";
  if (e.kind === "working-change")
    return (
      typeof e.repoKey === "string" &&
      typeof e.path === "string" &&
      ["add", "modify", "delete", "rename"].includes(
        String((e.payload as Record<string, unknown>).operation),
      )
    );
  return false;
}
function isSession(value: unknown): value is DesktopSession {
  if (!value || typeof value !== "object") return false;
  const s = value as Partial<DesktopSession>;
  return (
    Array.isArray(s.windows) &&
    Array.isArray(s.icons) &&
    Array.isArray(s.rubberBands) &&
    Array.isArray(s.taskbarOrder)
  );
}
export function loadSession(fallback: DesktopSession) {
  try {
    return migratePersistedSession(
      JSON.parse(localStorage.getItem(DESKTOP_STORAGE_KEY) || "null"),
      fallback,
    );
  } catch {
    return fallback;
  }
}
export function saveSession(session: DesktopSession) {
  localStorage.setItem(DESKTOP_STORAGE_KEY, serializeSession(session));
}
