import type { WindowBounds } from "./types";
export type DesktopViewport = {
  width: number;
  height: number;
  systemBarHeight: number;
  taskbarHeight: number;
};
export const DEFAULT_VIEWPORT: DesktopViewport = {
  width: 1440,
  height: 900,
  systemBarHeight: 46,
  taskbarHeight: 76,
};
export function usableBounds(v: DesktopViewport): WindowBounds {
  return {
    x: 0,
    y: v.systemBarHeight,
    width: v.width,
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
      Math.max(bounds.x, -width + titleReach),
      area.width - titleReach,
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
