import { describe, expect, test } from "bun:test";
import { deriveCloseDomainScope, languageFromPath } from "./lifecycle";
import { demoLifecycle } from "./WindowManagerProvider";
import type { DesktopWindowState, WindowOwner, WindowResource } from "./types";

type ScopeTarget = Pick<DesktopWindowState, "id" | "applicationId" | "owner" | "resource"> &
  Partial<DesktopWindowState>;

const window = (
  id: string,
  applicationId: string,
  resource: WindowResource,
  owner: WindowOwner = { type: "desktop" },
): DesktopWindowState => ({
  id,
  kind: "repository",
  applicationId,
  owner,
  resource,
  title: `${applicationId} ${id}`,
  iconKey: "repo",
  presentation: "normal",
  minimized: false,
  bounds: { x: 0, y: 0, width: 1, height: 1 },
  zIndex: 1,
  groupKey: "g",
  createdAt: 0,
  lastFocusedAt: 0,
});

const repoResource = (repoKey: string): WindowResource => ({
  type: "repository",
  repoKey,
});
const fileResource = (repoKey: string, path: string): WindowResource => ({
  type: "file",
  repoKey,
  path,
});

describe("deriveCloseDomainScope", () => {
  test("repository-explorer resolves to repository scope", () => {
    const scope = deriveCloseDomainScope({
      transactionId: "t",
      target: window("repo-anvil", "repository-explorer", repoResource("Lootziffer666/ANVIL")),
      children: [],
      reason: "user-request",
    });
    expect(scope).toEqual({
      mode: "repository",
      repoKey: "Lootziffer666/ANVIL",
    });
  });
  test("file-editor resolves to editor scope with path", () => {
    const scope = deriveCloseDomainScope({
      transactionId: "t",
      target: window("anvil-a", "file-editor", fileResource("Lootziffer666/ANVIL", "src/a.ts")),
      children: [],
      reason: "user-request",
    });
    expect(scope).toEqual({
      mode: "editor",
      repoKey: "Lootziffer666/ANVIL",
      path: "src/a.ts",
    });
  });
  test("image-viewer resolves to viewer scope", () => {
    const scope = deriveCloseDomainScope({
      transactionId: "t",
      target: window("anvil-img", "image-viewer", fileResource("Lootziffer666/ANVIL", "a.svg")),
      children: [],
      reason: "user-request",
    });
    expect(scope).toEqual({
      mode: "viewer",
      repoKey: "Lootziffer666/ANVIL",
      path: "a.svg",
    });
  });
  test("github-feature resolves to application scope with repoKey", () => {
    const scope = deriveCloseDomainScope({
      transactionId: "t",
      target: window("shaded-actions", "github-feature", {
        type: "github-feature",
        repoKey: "Lootziffer666/SHADED",
        featureId: "actions",
      }),
      children: [],
      reason: "user-request",
    });
    expect(scope).toEqual({
      mode: "application",
      applicationId: "github-feature",
      repoKey: "Lootziffer666/SHADED",
    });
  });
  test("tool-window resolves to application scope with null repoKey", () => {
    const scope = deriveCloseDomainScope({
      transactionId: "t",
      target: window("scratch", "tool-window", { type: "tool", toolId: "x" }),
      children: [],
      reason: "user-request",
    });
    expect(scope).toEqual({
      mode: "application",
      applicationId: "tool-window",
      repoKey: null,
    });
  });
  test("repository-owned child window resolves to application scope with owner repoKey", () => {
    const scope = deriveCloseDomainScope({
      transactionId: "t",
      target: window(
        "bin",
        "settings",
        { type: "system", systemId: "settings" },
        { type: "repository", repoKey: "Lootziffer666/ANVIL", repositoryWindowId: "repo-anvil" },
      ),
      children: [],
      reason: "user-request",
    });
    expect(scope).toEqual({
      mode: "application",
      applicationId: "settings",
      repoKey: "Lootziffer666/ANVIL",
    });
  });
});

describe("languageFromPath", () => {
  test("maps common extensions", () => {
    expect(languageFromPath("a.ts")).toBe("typescript");
    expect(languageFromPath("a.tsx")).toBe("typescript");
    expect(languageFromPath("a.md")).toBe("markdown");
    expect(languageFromPath("a.svg")).toBe("xml");
    expect(languageFromPath("a.unknown")).toBe("plaintext");
  });
});

describe("close scope isolation (demoLifecycle)", () => {
  const inspection = (w: DesktopWindowState) => ({
    transactionId: "t",
    target: w,
    children: [],
    reason: "user-request" as const,
  });

  test("repository window (ANVIL) reports an unsaved-draft blocker", async () => {
    const blockers = await demoLifecycle.inspectClose(
      inspection(window("repo-anvil", "repository-explorer", repoResource("Lootziffer666/ANVIL"))),
    );
    expect(blockers).toHaveLength(1);
    expect(blockers[0].type).toBe("unsaved-draft");
  });
  test("non-ANVIL repository reports no blocker", async () => {
    const blockers = await demoLifecycle.inspectClose(
      inspection(window("repo-shaded", "repository-explorer", repoResource("Lootziffer666/SHADED"))),
    );
    expect(blockers).toHaveLength(0);
  });
  test("isolated editor/viewer/tool/github-feature windows are never draft-blocked", async () => {
    const targets = [
      window("e", "file-editor", fileResource("Lootziffer666/ANVIL", "src/a.ts")),
      window("v", "image-viewer", fileResource("Lootziffer666/ANVIL", "a.svg")),
      window("t", "tool-window", { type: "tool", toolId: "x" }),
      window("g", "github-feature", { type: "github-feature", repoKey: "Lootziffer666/SHADED", featureId: "actions" }),
    ];
    for (const t of targets) {
      expect(await demoLifecycle.inspectClose(inspection(t))).toHaveLength(0);
    }
  });

  test("repository discard creates exactly one repo-scoped kernel entry", async () => {
    const result = await demoLifecycle.resolveClose(
      {
        transactionId: "t",
        inspectionStatus: "ready",
        resolutionStatus: "idle",
        target: window("repo-anvil", "repository-explorer", repoResource("Lootziffer666/ANVIL")),
        children: [],
        blockers: [],
        reason: "user-request",
      },
      { action: "discard-to-recycle-bin-and-close" },
    );
    expect(result.success).toBe(true);
    expect(result.recycleBinEntries).toHaveLength(1);
    expect(result.recycleBinEntries?.[0]).toMatchObject({
      kind: "draft",
      repoKey: "Lootziffer666/ANVIL",
      path: "docs/unsaved-demo.md",
      payload: { language: "markdown" },
    });
  });
  test("editor discard creates exactly one file-scoped kernel entry with language", async () => {
    const result = await demoLifecycle.resolveClose(
      {
        transactionId: "t",
        inspectionStatus: "ready",
        resolutionStatus: "idle",
        target: window("e", "file-editor", fileResource("Lootziffer666/ANVIL", "src/a.ts")),
        children: [],
        blockers: [],
        reason: "user-request",
      },
      { action: "discard-to-recycle-bin-and-close" },
    );
    expect(result.success).toBe(true);
    expect(result.recycleBinEntries).toHaveLength(1);
    expect(result.recycleBinEntries?.[0]).toMatchObject({
      kind: "draft",
      repoKey: "Lootziffer666/ANVIL",
      path: "src/a.ts",
      payload: { language: "typescript" },
    });
  });
  test("viewer/tool discard creates no kernel entries", async () => {
    for (const t of [
      window("v", "image-viewer", fileResource("Lootziffer666/ANVIL", "a.svg")),
      window("t", "tool-window", { type: "tool", toolId: "x" }),
    ]) {
      const result = await demoLifecycle.resolveClose(
        {
          transactionId: "t",
          inspectionStatus: "ready",
          resolutionStatus: "idle",
          target: t,
          children: [],
          blockers: [],
          reason: "user-request",
        },
        { action: "discard-to-recycle-bin-and-close" },
      );
      expect(result.success).toBe(true);
      expect(result.recycleBinEntries ?? []).toHaveLength(0);
    }
  });
  test("commit-and-close never creates recycle entries", async () => {
    const result = await demoLifecycle.resolveClose(
      {
        transactionId: "t",
        inspectionStatus: "ready",
        resolutionStatus: "idle",
        target: window("e", "file-editor", fileResource("Lootziffer666/ANVIL", "src/a.ts")),
        children: [],
        blockers: [],
        reason: "user-request",
      },
      { action: "commit-and-close" },
    );
    expect(result.success).toBe(true);
    expect(result.recycleBinEntries ?? []).toHaveLength(0);
  });
  test("close-clean resolves successfully", async () => {
    const result = await demoLifecycle.resolveClose(
      {
        transactionId: "t",
        inspectionStatus: "ready",
        resolutionStatus: "idle",
        target: window("e", "file-editor", fileResource("Lootziffer666/ANVIL", "src/a.ts")),
        children: [],
        blockers: [],
        reason: "user-request",
      },
      { action: "close-clean" },
    );
    expect(result.success).toBe(true);
  });
});
