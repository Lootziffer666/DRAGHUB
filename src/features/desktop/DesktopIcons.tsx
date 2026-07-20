"use client";
import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import { snapPoint } from "./geometry";
import { icon } from "./WindowFrame";
import { useWindowManager } from "./WindowManagerProvider";
import type { DesktopIconState } from "./types";
export function DesktopIcons() {
  const wm = useWindowManager();
  return (
    <div className="desktop-icon-layer">
      {wm.session.icons.map((item) => (
        <DesktopIcon key={item.id} item={item} />
      ))}
    </div>
  );
}
function DesktopIcon({ item }: { item: DesktopIconState }) {
  const wm = useWindowManager();
  const drag = useRef<{
    x: number;
    y: number;
    left: number;
    top: number;
  } | null>(null);
  const open = () => {
    if (
      item.kind === "repository-drive" &&
      item.resource?.type === "repository"
    )
      wm.openOrFocusWindow({
        applicationId: "repository-explorer",
        owner: { type: "desktop" },
        resource: item.resource,
        title: `${item.title} — Demo`,
      });
    else if (item.resource?.type === "system")
      wm.openOrFocusWindow({
        applicationId: item.kind === "recycle-bin" ? "recycle-bin" : "settings",
        owner: { type: "desktop" },
        resource: item.resource,
        title: item.title,
      });
  };
  const key = (e: KeyboardEvent) => {
    if (e.key === "Enter") open();
  };
  return (
    <button
      className={`desktop-shortcut ${item.selected ? "selected" : ""}`}
      style={{ left: item.position.x, top: item.position.y }}
      onClick={(e) => wm.selectIcons([item.id], e.ctrlKey || e.metaKey)}
      onDoubleClick={open}
      onKeyDown={key}
      onPointerDown={(e: PointerEvent) => {
        drag.current = {
          x: e.clientX,
          y: e.clientY,
          left: item.position.x,
          top: item.position.y,
        };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (
          drag.current &&
          Math.hypot(e.clientX - drag.current.x, e.clientY - drag.current.y) > 4
        )
          wm.moveIcon(
            item.id,
            snapPoint(drag.current.left + e.clientX - drag.current.x),
            snapPoint(drag.current.top + e.clientY - drag.current.y),
          );
      }}
      onPointerUp={() => {
        drag.current = null;
        wm.flushPersistence();
      }}
    >
      <span>{icon(item.iconKey)}</span>
      <b>{item.title}</b>
      {item.kind === "repository-drive" && <small>DEMO DRIVE</small>}
    </button>
  );
}
