"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { FluentProvider } from "@fluentui/react-components";
import { draghubDarkTheme, draghubLightTheme } from "./themes";
import {
  applyThemeToDocument,
  loadStoredThemeMode,
  storeThemeMode,
  DEFAULT_THEME_MODE,
  type ThemeMode,
} from "./theme-storage";

type ThemeContextValue = {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Owns theme mode only — it never touches WindowManagerProvider,
 * StoreProvider or any desktop/session state, so switching themes re-renders
 * (never remounts) the desktop tree beneath it: open windows, their
 * positions, editor drafts and tabs are untouched.
 *
 * Renders "light" on both the server and the first client render so
 * hydration never mismatches (see `suppressHydrationWarning` + the blocking
 * inline script in layout.tsx, which paints the persisted theme onto
 * `<html>` before React hydrates — that avoids the visible flash; this
 * effect then brings React's own state in sync immediately on mount).
 */
export function DraghubThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(DEFAULT_THEME_MODE);

  useEffect(() => {
    const stored = loadStoredThemeMode();
    setModeState(stored);
    applyThemeToDocument(stored);
    // Mount-only: restores the persisted selection once, after hydration
    // has safely completed with the matching SSR default.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    storeThemeMode(next);
    applyThemeToDocument(next);
  }, []);

  const toggleMode = useCallback(() => {
    setModeState((current) => {
      const next: ThemeMode = current === "light" ? "dark" : "light";
      storeThemeMode(next);
      applyThemeToDocument(next);
      return next;
    });
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, setMode, toggleMode }),
    [mode, setMode, toggleMode],
  );
  const fluentTheme = mode === "dark" ? draghubDarkTheme : draghubLightTheme;

  return (
    <ThemeContext.Provider value={value}>
      <FluentProvider theme={fluentTheme} style={{ height: "100%" }}>
        {children}
      </FluentProvider>
    </ThemeContext.Provider>
  );
}

export function useDraghubTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useDraghubTheme must be used within DraghubThemeProvider");
  }
  return ctx;
}
