export type ThemeMode = "light" | "dark";

/** localStorage key for the user's explicit theme selection. Stable —
 * never rename without a migration, existing sessions depend on it. */
export const THEME_STORAGE_KEY = "draghub-theme";

/** DRAGHUB starts in light mode unless the user has explicitly chosen dark. */
export const DEFAULT_THEME_MODE: ThemeMode = "light";

function isThemeMode(value: unknown): value is ThemeMode {
  return value === "light" || value === "dark";
}

/** Reads the persisted theme selection. Any missing or invalid stored value
 * (including a corrupted/foreign string) falls back to the light default —
 * never throws, safe to call during render or before hydration. */
export function loadStoredThemeMode(): ThemeMode {
  if (typeof localStorage === "undefined") return DEFAULT_THEME_MODE;
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeMode(raw) ? raw : DEFAULT_THEME_MODE;
  } catch {
    return DEFAULT_THEME_MODE;
  }
}

/** Persists an explicit user selection. Silently no-ops if storage is
 * unavailable (private browsing, quota) — the in-memory theme still applies
 * for the session, it just won't survive a reload. */
export function storeThemeMode(mode: ThemeMode): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
}

/** Applies the theme to the document root: `data-theme` for CSS selectors
 * and `color-scheme` so native form controls, scrollbars and media
 * controls render in the matching palette. Safe to call before React
 * hydrates (see the inline script in layout.tsx) and again once it has. */
export function applyThemeToDocument(mode: ThemeMode): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = mode;
  document.documentElement.style.colorScheme = mode;
}
