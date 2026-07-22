import type { WindowBounds } from "./types";
export type DesktopViewport = {
  width: number;
  height: number;
  systemBarHeight: number;
  taskbarHeight: number;
  /** Width reserved for the persistent left-edge Dock. Windows — including
   * maximized ones — must never render behind it (MULTI_REPO_WINDOW_DOCK_SPEC
   * §8: "The Dock must have reserved layout space"). */
  dockWidth: number;
};
export const DEFAULT_VIEWPORT: DesktopViewport = {
  width: 1440,
  height: 900,
  systemBarHeight: 46,
  taskbarHeight: 76,
  dockWidth: 72,
};
export function usableBounds(v: DesktopViewport): WindowBounds {
  return {
    x: v.dockWidth,
    y: v.systemBarHeight,
    width: Math.max(200, v.width - v.dockWidth),
    height: Math.max(200, v.height - v.systemBarHeight - v.taskbarHeight),
  };
}
export function clampBounds(
  bounds: WindowBounds,
  v: DesktopViewport,
): WindowBounds {
  const area = usableBounds(v);
  const titleReach = 120;
  const width = Math.min(Math.max(bounds.width, 280), area.width);
  const height = Math.min(Math.max(bounds.height, 180), area.height);
  return {
    width,
    height,
    x: Math.min(
      Math.max(bounds.x, area.x - width + titleReach),
      area.x + area.width - titleReach,
    ),
    y: Math.min(Math.max(bounds.y, area.y), area.y + area.height - 44),
  };
}
export function maximizeBounds(v: DesktopViewport): WindowBounds {
  return usableBounds(v);
}
export function snapPoint(value: number, grid = 16) {
  return Math.round(value / grid) * grid;
}
export type ResizeDirection = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
export function resizeBounds(
  original: WindowBounds,
  direction: ResizeDirection,
  deltaX: number,
  deltaY: number,
  minimumSize: { width: number; height: number },
  viewport: DesktopViewport,
): WindowBounds {
  let { x, y, width, height } = original;
  if (direction.includes("e")) width += deltaX;
  if (direction.includes("s")) height += deltaY;
  if (direction.includes("w")) {
    width -= deltaX;
    x += deltaX;
  }
  if (direction.includes("n")) {
    height -= deltaY;
    y += deltaY;
  }
  if (width < minimumSize.width) {
    if (direction.includes("w")) x -= minimumSize.width - width;
    width = minimumSize.width;
  }
  if (height < minimumSize.height) {
    if (direction.includes("n")) y -= minimumSize.height - height;
    height = minimumSize.height;
  }
  return clampBounds({ x, y, width, height }, viewport);
}
export function clampMenuPosition(
  x: number,
  y: number,
  menu: { width: number; height: number },
  viewport: { width: number; height: number },
) {
  return {
    x: Math.max(0, Math.min(x, viewport.width - menu.width)),
    y: Math.max(0, Math.min(y, viewport.height - menu.height)),
  };
}
