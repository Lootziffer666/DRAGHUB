import { describe, expect, test } from "bun:test";
import {
  DEFAULT_VIEWPORT,
  clampBounds,
  clampMenuPosition,
  resizeBounds,
  type ResizeDirection,
} from "./geometry";
import {
  childOwner,
  focusWindowState,
  groupTaskbar,
  maximizeWindowState,
  minimizeWindowState,
  mobileVisibleWindow,
  openOrFocusWindowState,
  openWindowState,
  restoreMaximizedState,
  restoreWindowState,
  closeWindowState,
} from "./window-state";
import { migratePersistedSession, sanitizeDesktopSession } from "./persistence";
import type { DesktopSession, OpenWindowInput } from "./types";
import { resolveCloseTransaction } from "./lifecycle";
const empty = (): DesktopSession => ({
  windows: [],
  icons: [],
  rubberBands: [],
  taskbarOrder: [],
  pendingCloseId: null,
  activeWindowId: null,
  closeContext: null,
  recycleBin: [],
  restoredItems: [],
  recycleError: null,
});
const input: OpenWindowInput = {
  applicationId: "repository-explorer",
  owner: { type: "desktop" },
  resource: { type: "repository", repoKey: "Lootziffer666/ANVIL" },
  title: "ANVIL",
};
describe("window state", () => {
  test("focus assigns highest z-index", () => {
    let s = openWindowState(empty(), input, DEFAULT_VIEWPORT);
    s = openWindowState(
      s,
      {
        ...input,
        resource: { type: "repository", repoKey: "Lootziffer666/SHADED" },
      },
      DEFAULT_VIEWPORT,
    );
    const focused = focusWindowState(s, s.windows[0].id);
    expect(focused.windows[0].zIndex).toBeGreaterThan(
      focused.windows[1].zIndex,
    );
  });
  test("minimize and restore preserve the window", () => {
    const s = openWindowState(empty(), input, DEFAULT_VIEWPORT),
      id = s.windows[0].id;
    expect(minimizeWindowState(s, id).windows[0].state).toBe("minimized");
    expect(
      restoreWindowState(minimizeWindowState(s, id), id).windows[0].state,
    ).toBe("normal");
  });
  test("maximize restores exact bounds", () => {
    const s = openWindowState(
        empty(),
        { ...input, bounds: { x: 123, y: 97, width: 611, height: 411 } },
        DEFAULT_VIEWPORT,
      ),
      id = s.windows[0].id;
    const max = maximizeWindowState(s, id, DEFAULT_VIEWPORT);
    expect(restoreMaximizedState(max, id).windows[0].bounds).toEqual(
      s.windows[0].bounds,
    );
  });
  test("clamps reachable title area", () => {
    const b = clampBounds(
      { x: -900, y: -300, width: 600, height: 400 },
      DEFAULT_VIEWPORT,
    );
    expect(b.x).toBeGreaterThanOrEqual(-480);
    expect(b.y).toBe(46);
  });
  test("openOrFocus avoids duplicates and restores", () => {
    let s = openOrFocusWindowState(empty(), input, DEFAULT_VIEWPORT);
    s = minimizeWindowState(s, s.windows[0].id);
    s = openOrFocusWindowState(s, input, DEFAULT_VIEWPORT);
    expect(s.windows).toHaveLength(1);
    expect(s.windows[0].state).toBe("normal");
  });
  test("taskbar groups repository applications", () => {
    let s = openWindowState(empty(), input, DEFAULT_VIEWPORT);
    const owner = childOwner("Lootziffer666/ANVIL", s.windows[0].id);
    s = openWindowState(
      s,
      {
        applicationId: "image-viewer",
        owner,
        resource: {
          type: "file",
          repoKey: "Lootziffer666/ANVIL",
          path: "a.png",
        },
      },
      DEFAULT_VIEWPORT,
    );
    expect(groupTaskbar(s.windows)).toHaveLength(1);
    expect(groupTaskbar(s.windows)[0].items).toHaveLength(2);
    expect(s.windows[1].owner).toEqual(owner);
  });
  test("two repositories form exactly two groups", () => {
    let s = openWindowState(empty(), input, DEFAULT_VIEWPORT);
    const anvil = s.windows[0];
    s = openWindowState(
      s,
      {
        ...input,
        resource: { type: "repository", repoKey: "Lootziffer666/SHADED" },
      },
      DEFAULT_VIEWPORT,
    );
    const shaded = s.windows[1];
    s = openWindowState(
      s,
      {
        applicationId: "image-viewer",
        owner: childOwner("Lootziffer666/ANVIL", anvil.id),
        resource: {
          type: "file",
          repoKey: "Lootziffer666/ANVIL",
          path: "a.png",
        },
      },
      DEFAULT_VIEWPORT,
    );
    s = openWindowState(
      s,
      {
        applicationId: "github-feature",
        owner: childOwner("Lootziffer666/SHADED", shaded.id),
        resource: {
          type: "github-feature",
          repoKey: "Lootziffer666/SHADED",
          featureId: "actions",
        },
      },
      DEFAULT_VIEWPORT,
    );
    expect(groupTaskbar(s.windows)).toHaveLength(2);
  });
  test("minimizing retains the same instance data", () => {
    const s = openWindowState(empty(), input, DEFAULT_VIEWPORT);
    const w = s.windows[0],
      min = minimizeWindowState(s, w.id);
    expect(min.windows).toHaveLength(1);
    expect(min.windows[0].id).toBe(w.id);
    expect(min.windows[0].resource).toBe(w.resource);
  });
  test("closing parent atomically cleans children and references but keeps icon", () => {
    let s = {
      ...empty(),
      icons: [
        {
          id: "anvil",
          kind: "repository-drive" as const,
          title: "ANVIL",
          iconKey: "repo",
          resource: input.resource,
          position: { x: 0, y: 0 },
          selected: false,
          pinned: true,
        },
      ],
    };
    s = openWindowState(s, input, DEFAULT_VIEWPORT);
    const id = s.windows[0].id;
    s = openWindowState(
      s,
      {
        applicationId: "image-viewer",
        owner: childOwner("Lootziffer666/ANVIL", id),
        resource: {
          type: "file",
          repoKey: "Lootziffer666/ANVIL",
          path: "a.png",
        },
      },
      DEFAULT_VIEWPORT,
    );
    s = {
      ...s,
      rubberBands: [
        {
          repoKey: "Lootziffer666/ANVIL",
          repositoryWindowId: id,
          edge: "top",
          collapsed: false,
          autoHide: false,
          itemOrder: [],
        },
      ],
      activeWindowId: s.windows[1].id,
    };
    const closed = closeWindowState(s, id);
    expect(closed.windows).toHaveLength(0);
    expect(closed.taskbarOrder).toHaveLength(0);
    expect(closed.rubberBands).toHaveLength(0);
    expect(closed.activeWindowId).toBeNull();
    expect(closed.icons).toHaveLength(1);
  });
  test("discard creates recoverable entries", () => {
    const s = openWindowState(empty(), input, DEFAULT_VIEWPORT);
    const entry = {
      id: "draft",
      kind: "draft" as const,
      sourceWindowId: s.windows[0].id,
      label: "draft",
      discardedAt: 1,
      payload: { content: "recover" },
    };
    expect(closeWindowState(s, s.windows[0].id, [entry]).recycleBin).toEqual([
      entry,
    ]);
  });
  test("allowMultiple false focuses system window while true permits explicit duplicates", () => {
    const system = {
      applicationId: "settings",
      owner: { type: "desktop" as const },
      resource: { type: "system" as const, systemId: "settings" },
    };
    let s = openWindowState(empty(), system, DEFAULT_VIEWPORT);
    s = openWindowState(
      s,
      { ...system, resource: { type: "system", systemId: "other" } },
      DEFAULT_VIEWPORT,
    );
    expect(s.windows).toHaveLength(1);
    s = openWindowState(s, input, DEFAULT_VIEWPORT);
    s = openWindowState(s, input, DEFAULT_VIEWPORT);
    expect(
      s.windows.filter((w) => w.applicationId === "repository-explorer"),
    ).toHaveLength(2);
  });
  test("settings and recycle bin are independent singletons", () => {
    const settings = {
      applicationId: "settings",
      owner: { type: "desktop" as const },
      resource: { type: "system" as const, systemId: "settings" },
    };
    const bin = {
      applicationId: "recycle-bin",
      owner: { type: "desktop" as const },
      resource: { type: "system" as const, systemId: "recycle-bin" },
    };
    let s = openWindowState(empty(), settings, DEFAULT_VIEWPORT);
    s = openWindowState(s, bin, DEFAULT_VIEWPORT);
    s = openWindowState(s, settings, DEFAULT_VIEWPORT);
    s = openWindowState(s, bin, DEFAULT_VIEWPORT);
    expect(s.windows.map((w) => w.applicationId)).toEqual([
      "settings",
      "recycle-bin",
    ]);
  });
  test("identical child resources deduplicate but distinct files do not", () => {
    let s = openWindowState(empty(), input, DEFAULT_VIEWPORT);
    const owner = childOwner("Lootziffer666/ANVIL", s.windows[0].id);
    const child = (path: string) => ({
      applicationId: "image-viewer",
      owner,
      resource: { type: "file" as const, repoKey: "Lootziffer666/ANVIL", path },
    });
    s = openOrFocusWindowState(s, child("a.png"), DEFAULT_VIEWPORT);
    s = openOrFocusWindowState(s, child("a.png"), DEFAULT_VIEWPORT);
    s = openOrFocusWindowState(s, child("b.png"), DEFAULT_VIEWPORT);
    expect(
      s.windows.filter((w) => w.applicationId === "image-viewer"),
    ).toHaveLength(2);
  });
  test("minimizing active transfers focus and minimizing last clears it", () => {
    let s = openWindowState(empty(), input, DEFAULT_VIEWPORT);
    s = openWindowState(
      s,
      { ...input, resource: { type: "repository", repoKey: "SHADED" } },
      DEFAULT_VIEWPORT,
    );
    const active = s.windows[1].id;
    s = minimizeWindowState(s, active);
    expect(s.activeWindowId).toBe(s.windows[0].id);
    s = minimizeWindowState(s, s.windows[0].id);
    expect(s.activeWindowId).toBeNull();
  });
  test("all eight resize directions respect minimums", () => {
    for (const d of [
      "n",
      "s",
      "e",
      "w",
      "ne",
      "nw",
      "se",
      "sw",
    ] as ResizeDirection[]) {
      const b = resizeBounds(
        { x: 100, y: 100, width: 400, height: 300 },
        d,
        -500,
        -500,
        { width: 320, height: 220 },
        DEFAULT_VIEWPORT,
      );
      expect(b.width).toBeGreaterThanOrEqual(320);
      expect(b.height).toBeGreaterThanOrEqual(220);
    }
  });
  test("context menu clamps to viewport", () =>
    expect(
      clampMenuPosition(
        990,
        790,
        { width: 200, height: 150 },
        { width: 1000, height: 800 },
      ),
    ).toEqual({ x: 800, y: 650 }));
  test("mobile selection uses active non-minimized window", () => {
    let s = openWindowState(empty(), input, DEFAULT_VIEWPORT);
    s = openWindowState(
      s,
      { ...input, resource: { type: "repository", repoKey: "SHADED" } },
      DEFAULT_VIEWPORT,
    );
    expect(mobileVisibleWindow(s)?.resource).toEqual({
      type: "repository",
      repoKey: "SHADED",
    });
    s = minimizeWindowState(s, s.windows[1].id);
    expect(mobileVisibleWindow(s)?.id).toBe(s.windows[0].id);
  });
});
describe("persistence", () => {
  test("migrates v1 and rejects invalid data", () => {
    const s = empty();
    expect(
      migratePersistedSession({ version: 1, session: s }, empty())
        .pendingCloseId,
    ).toBeNull();
    expect(
      migratePersistedSession({ version: 4, session: { bad: true } }, s),
    ).toBe(s);
  });
  test("sanitization drops corrupt windows and dead references", () => {
    let s = openWindowState(empty(), input, DEFAULT_VIEWPORT);
    const valid = s.windows[0];
    s = {
      ...s,
      windows: [
        valid,
        {
          ...valid,
          id: "bad",
          applicationId: "unknown",
          state: "broken" as never,
          bounds: { x: NaN, y: 0, width: 1, height: 1 },
        },
      ],
      taskbarOrder: [valid.id, "dead"],
      rubberBands: [
        {
          repoKey: "x",
          repositoryWindowId: "dead",
          edge: "top",
          collapsed: false,
          autoHide: false,
          itemOrder: [],
        },
      ],
      activeWindowId: "dead",
    };
    const clean = sanitizeDesktopSession(s, empty());
    expect(clean.windows).toHaveLength(1);
    expect(clean.taskbarOrder).toEqual([valid.id]);
    expect(clean.rubberBands).toHaveLength(0);
    expect(clean.activeWindowId).toBeNull();
  });
});
describe("close transaction", () => {
  test("cancel and failed resolution retain every window; success removes only after await", async () => {
    const s = openWindowState(empty(), input, DEFAULT_VIEWPORT),
      target = s.windows[0],
      context = {
        target,
        children: [],
        blockers: [
          {
            type: "unsaved-draft" as const,
            windowId: target.id,
            label: "draft",
          },
        ],
        reason: "user-request" as const,
      };
    const fail = {
      inspectClose: async () => [],
      resolveClose: async () => ({ success: false, error: "nope" }),
    };
    expect(
      (await resolveCloseTransaction(s, context, { action: "cancel" }, fail))
        .windows,
    ).toHaveLength(1);
    const failed = await resolveCloseTransaction(
      s,
      context,
      { action: "commit-and-close" },
      fail,
    );
    expect(failed.windows).toHaveLength(1);
    expect(failed.closeContext?.error).toBe("nope");
    const success = { ...fail, resolveClose: async () => ({ success: true }) };
    expect(
      (
        await resolveCloseTransaction(
          s,
          context,
          { action: "commit-and-close" },
          success,
        )
      ).windows,
    ).toHaveLength(0);
  });
  test("discard accepts adapter payload unchanged while commit creates none", async () => {
    const s = openWindowState(empty(), input, DEFAULT_VIEWPORT),
      target = s.windows[0],
      context = {
        target,
        children: [],
        blockers: [],
        reason: "user-request" as const,
      };
    const entry = {
      id: "adapter-entry",
      kind: "draft" as const,
      sourceWindowId: target.id,
      label: "recover me",
      discardedAt: 5,
      payload: { content: "exact payload" },
    };
    const adapter = {
      inspectClose: async () => [],
      resolveClose: async (_c: unknown, r: { action: string }) => ({
        success: true,
        recycleBinEntries: r.action.includes("discard") ? [entry] : undefined,
      }),
    };
    const discarded = await resolveCloseTransaction(
      s,
      context,
      { action: "discard-to-recycle-bin-and-close" },
      adapter,
    );
    expect(discarded.recycleBin).toEqual([entry]);
    const committed = await resolveCloseTransaction(
      s,
      context,
      { action: "commit-and-close" },
      adapter,
    );
    expect(committed.recycleBin).toEqual([]);
  });
});
