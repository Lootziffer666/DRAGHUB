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
