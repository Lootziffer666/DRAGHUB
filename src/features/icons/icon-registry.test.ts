import { describe, expect, test } from "bun:test";
import { appIconFor } from "./app-icon-registry";
import { DraghubMark } from "./brand-marks";
import { fileIconForPath, fileIconKeyForPath, resolveFileIcon } from "./file-icon-registry";

// Every iconKey ever persisted by application-registry.tsx's
// WindowApplicationDefinition entries and WindowManagerProvider's
// initialIcons — old desktop sessions must keep resolving these.
const PERSISTED_APP_ICON_KEYS = ["repo", "image", "tool", "github", "settings", "bin"];

describe("appIconFor — persisted icon keys resolve to real components", () => {
  test.each(PERSISTED_APP_ICON_KEYS)("%s resolves to a defined component", (key) => {
    const Icon = appIconFor(key);
    expect(Icon).toBeDefined();
    expect(typeof Icon === "function" || typeof Icon === "object").toBe(true);
  });

  test("distinct persisted keys resolve to distinct components (no accidental aliasing)", () => {
    const resolved = new Set(PERSISTED_APP_ICON_KEYS.map((k) => appIconFor(k)));
    expect(resolved.size).toBe(PERSISTED_APP_ICON_KEYS.length);
  });

  test("'tool' (shared by file-editor and Scratchpad) resolves the same way every time", () => {
    expect(appIconFor("tool")).toBe(appIconFor("tool"));
  });

  test("an unknown/legacy key falls back to the DRAGHUB mark instead of throwing", () => {
    expect(() => appIconFor("some-removed-application")).not.toThrow();
    expect(appIconFor("some-removed-application")).toBe(DraghubMark);
  });

  test("every documented semantic app icon key resolves to a defined component", () => {
    const keys = [
      "repository",
      "image",
      "code",
      "github",
      "settings",
      "recycle-bin",
      "search",
      "launcher",
      "changes",
      "pull-requests",
      "issues",
      "actions",
      "triage",
      "releases",
      "security",
      "upload",
      "branch",
      "open-external",
      "copy",
      "edit",
      "save",
      "close",
      "refresh",
    ];
    for (const key of keys) {
      expect(appIconFor(key)).toBeDefined();
    }
  });
});

describe("file icon registry", () => {
  test("every file-type key resolves to a defined component", () => {
    const keys = ["folder", "folder-open", "file", "code", "image", "audio", "markdown", "archive"] as const;
    for (const key of keys) {
      expect(resolveFileIcon(key)).toBeDefined();
    }
  });

  test("fileIconKeyForPath classifies known extensions correctly", () => {
    expect(fileIconKeyForPath("logo.png")).toBe("image");
    expect(fileIconKeyForPath("theme.mp3")).toBe("audio");
    expect(fileIconKeyForPath("README.md")).toBe("markdown");
    expect(fileIconKeyForPath("archive.zip")).toBe("archive");
    expect(fileIconKeyForPath("notes.txt")).toBe("file");
    expect(fileIconKeyForPath("main.ts")).toBe("code");
    expect(fileIconKeyForPath("Dockerfile")).toBe("code");
  });

  test("fileIconForPath returns a defined component for any path", () => {
    for (const path of ["a.png", "a.mp3", "a.md", "a.zip", "a.txt", "a.ts", "noext"]) {
      expect(fileIconForPath(path)).toBeDefined();
    }
  });
});
