import type { DesktopSession } from "./types";
export const DESKTOP_STORAGE_KEY = "draghub.desktop.session";
export const DESKTOP_SESSION_VERSION = 2;
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
  if (data.version === 2 && isSession(data.session)) return data.session;
  if (data.version === 1 && isSession(data.session))
    return {
      ...data.session,
      pendingCloseId: null,
      mobileActiveWindowId: data.session.mobileActiveWindowId ?? null,
    };
  return fallback;
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
