import { describe, expect, test } from "bun:test";
import { repoKeyFromWindow } from "./index";
import type { DesktopWindowState } from "@/features/desktop/types";

function baseWindow(over: Partial<DesktopWindowState>): DesktopWindowState {
  return {
    id: "w1",
    kind: "repository",
    applicationId: "repository-explorer",
    owner: { type: "desktop" },
    resource: { type: "repository", repoKey: "owner/repo" },
    title: "owner/repo",
    iconKey: "repo",
    presentation: "normal",
    minimized: false,
    bounds: { x: 0, y: 0, width: 800, height: 600 },
    zIndex: 1,
    groupKey: "owner/repo",
    createdAt: 0,
    lastFocusedAt: 0,
    ...over,
  };
}

describe("repoKeyFromWindow — related search uses focused-window context", () => {
  test("no focused window yields null", () => {
    expect(repoKeyFromWindow(undefined)).toBeNull();
  });

  test("repository resource supplies its repoKey", () => {
    const w = baseWindow({ resource: { type: "repository", repoKey: "acme/widget" } });
    expect(repoKeyFromWindow(w)).toBe("acme/widget");
  });

  test("file resource supplies its repoKey", () => {
    const w = baseWindow({
      kind: "editor",
      applicationId: "file-editor",
      resource: { type: "file", repoKey: "acme/widget", path: "src/a.ts" },
    });
    expect(repoKeyFromWindow(w)).toBe("acme/widget");
  });

  test("github-feature resource supplies its repoKey", () => {
    const w = baseWindow({
      kind: "github-feature",
      applicationId: "github-feature",
      resource: { type: "github-feature", repoKey: "acme/widget", featureId: "issues" },
    });
    expect(repoKeyFromWindow(w)).toBe("acme/widget");
  });

  test("repository-owned child window falls back to owner repoKey", () => {
    const w = baseWindow({
      kind: "tool",
      applicationId: "tool-window",
      owner: { type: "repository", repoKey: "acme/widget", repositoryWindowId: "repo-1" },
      resource: { type: "tool", toolId: "scratchpad" },
    });
    expect(repoKeyFromWindow(w)).toBe("acme/widget");
  });

  test("system/tool focus (desktop-owned, non-repository resource) yields no related repository", () => {
    const settings = baseWindow({
      kind: "system",
      applicationId: "settings",
      owner: { type: "desktop" },
      resource: { type: "system", systemId: "settings" },
    });
    expect(repoKeyFromWindow(settings)).toBeNull();

    const scratchpad = baseWindow({
      kind: "tool",
      applicationId: "tool-window",
      owner: { type: "desktop" },
      resource: { type: "tool", toolId: "scratchpad" },
    });
    expect(repoKeyFromWindow(scratchpad)).toBeNull();

    const recycleBin = baseWindow({
      kind: "system",
      applicationId: "recycle-bin",
      owner: { type: "desktop" },
      resource: { type: "system", systemId: "recycle-bin" },
    });
    expect(repoKeyFromWindow(recycleBin)).toBeNull();
  });
});
