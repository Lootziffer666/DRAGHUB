import { beforeEach, describe, expect, test } from "bun:test";

const backing = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => backing.get(k) ?? null,
  setItem: (k: string, v: string) => void backing.set(k, v),
  removeItem: (k: string) => void backing.delete(k),
  clear: () => backing.clear(),
};

import {
  DEFAULT_THEME_MODE,
  THEME_STORAGE_KEY,
  loadStoredThemeMode,
  storeThemeMode,
} from "./theme-storage";

beforeEach(() => {
  backing.clear();
});

describe("theme-storage", () => {
  test("default mode is light", () => {
    expect(DEFAULT_THEME_MODE).toBe("light");
  });

  test("no stored value falls back to light", () => {
    expect(loadStoredThemeMode()).toBe("light");
  });

  test("stored light mode restores", () => {
    storeThemeMode("light");
    expect(loadStoredThemeMode()).toBe("light");
  });

  test("stored dark mode restores", () => {
    storeThemeMode("dark");
    expect(loadStoredThemeMode()).toBe("dark");
  });

  test("invalid stored values fall back to light", () => {
    backing.set(THEME_STORAGE_KEY, "solarized");
    expect(loadStoredThemeMode()).toBe("light");
    backing.set(THEME_STORAGE_KEY, "");
    expect(loadStoredThemeMode()).toBe("light");
    backing.set(THEME_STORAGE_KEY, "DARK");
    expect(loadStoredThemeMode()).toBe("light");
  });

  test("changing mode persists the new value, overwriting the old one", () => {
    storeThemeMode("dark");
    expect(loadStoredThemeMode()).toBe("dark");
    storeThemeMode("light");
    expect(loadStoredThemeMode()).toBe("light");
  });

  test("storeThemeMode never throws when localStorage is unavailable", () => {
    const original = (globalThis as Record<string, unknown>).localStorage;
    // @ts-expect-error deliberately simulating an environment without storage
    delete (globalThis as Record<string, unknown>).localStorage;
    expect(() => storeThemeMode("dark")).not.toThrow();
    expect(loadStoredThemeMode()).toBe("light");
    (globalThis as Record<string, unknown>).localStorage = original;
  });
});
