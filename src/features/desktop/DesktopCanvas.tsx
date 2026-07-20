"use client";
import { useRef, useState, type PointerEvent } from "react";
import { DesktopIcons } from "./DesktopIcons";
import { WindowFrame } from "./WindowFrame";
import { useWindowManager } from "./WindowManagerProvider";
import { mobileVisibleWindow } from "./window-state";
import { DesktopContextMenu } from "./context-menu";
export function DesktopCanvas() {
  const wm = useWindowManager();
  const [start, setStart] = useState<{ x: number; y: number } | null>(null);
  const [current, setCurrent] = useState<{ x: number; y: number } | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const mobile = wm.viewport.width < 720;
  const mobileWindow = mobileVisibleWindow(wm.session);
  const down = (e: PointerEvent) => {
    if (e.target !== canvas.current) return;
    wm.selectIcons([]);
    setStart({ x: e.clientX, y: e.clientY });
    setCurrent({ x: e.clientX, y: e.clientY });
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const up = () => {
    if (start && current) {
      const x1 = Math.min(start.x, current.x),
        x2 = Math.max(start.x, current.x),
        y1 = Math.min(start.y, current.y),
        y2 = Math.max(start.y, current.y);
      wm.selectIcons(
        wm.session.icons
          .filter(
            (i) =>
              i.position.x + 70 >= x1 &&
              i.position.x <= x2 &&
              i.position.y + 80 >= y1 &&
              i.position.y <= y2,
          )
          .map((i) => i.id),
      );
    }
    setStart(null);
    setCurrent(null);
  };
  return (
    <main
      ref={canvas}
      className="desktop-canvas"
      onPointerDown={down}
      onPointerMove={(e) => start && setCurrent({ x: e.clientX, y: e.clientY })}
      onPointerUp={up}
      onContextMenu={(e) => {
        if (e.target === canvas.current) {
          e.preventDefault();
          setMenu({ x: e.clientX, y: e.clientY });
        }
      }}
    >
      <DesktopIcons />
      {wm.session.windows.map((w) => (
        <WindowFrame
          key={w.id}
          window={w}
          mobileVisible={!mobile || w.id === mobileWindow?.id}
        />
      ))}
      {start && current && (
        <div
          className="selection-box"
          style={{
            left: Math.min(start.x, current.x),
            top: Math.min(start.y, current.y),
            width: Math.abs(start.x - current.x),
            height: Math.abs(start.y - current.y),
          }}
        />
      )}
      {menu && (
        <DesktopContextMenu x={menu.x} y={menu.y} onClose={() => setMenu(null)}>
          <strong>Desktop</strong>
          <button onClick={() => wm.selectIcons([])}>Clear selection</button>
          <button disabled>New shortcut (adapter required)</button>
        </DesktopContextMenu>
      )}
    </main>
  );
}
