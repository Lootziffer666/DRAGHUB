import { describe, expect, test } from "bun:test";
import { DEFAULT_VIEWPORT, clampBounds } from "./geometry";
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
} from "./window-state";
import { migratePersistedSession } from "./persistence";
import type { DesktopSession, OpenWindowInput } from "./types";
const empty = (): DesktopSession => ({
  windows: [],
  icons: [],
  rubberBands: [],
  taskbarOrder: [],
  pendingCloseId: null,
  mobileActiveWindowId: null,
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
    expect(groupTaskbar(s.windows)).toHaveLength(2);
    expect(s.windows[1].owner).toEqual(owner);
  });
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
      migratePersistedSession({ version: 2, session: { bad: true } }, s),
    ).toBe(s);
  });
});
