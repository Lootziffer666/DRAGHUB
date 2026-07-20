"use client";
import { useRef, type PointerEvent } from "react";
import type { ResizeDirection } from "./geometry";
import { getApplication } from "./application-registry";
import { useWindowManager } from "./WindowManagerProvider";
import type { DesktopWindowState } from "./types";
export function WindowFrame({
  window,
  mobileVisible = true,
}: {
  window: DesktopWindowState;
  mobileVisible?: boolean;
}) {
  const wm = useWindowManager();
  const app = getApplication(window.applicationId);
  const drag = useRef<{ x: number; y: number; bx: number; by: number } | null>(
    null,
  );
  const size = useRef<{
    x: number;
    y: number;
    width: number;
    height: number;
    direction: ResizeDirection;
    original: DesktopWindowState["bounds"];
  } | null>(null);
  const active =
    wm.session.mobileActiveWindowId === window.id ||
    window.zIndex === Math.max(...wm.session.windows.map((w) => w.zIndex));
  const pointerMove = (e: PointerEvent) => {
    if (drag.current)
      wm.moveWindow(
        window.id,
        drag.current.bx + e.clientX - drag.current.x,
        drag.current.by + e.clientY - drag.current.y,
      );
  };
  return (
    <section
      tabIndex={-1}
      className={`desktop-window ${active ? "active" : ""} ${window.state === "maximized" ? "maximized" : ""} ${window.state === "minimized" ? "is-minimized" : ""} ${mobileVisible ? "mobile-visible" : "mobile-hidden"}`}
      aria-hidden={window.state === "minimized" || !mobileVisible}
      inert={window.state === "minimized" || !mobileVisible ? true : undefined}
      data-window-id={window.id}
      style={{
        left: window.bounds.x,
        top: window.bounds.y,
        width: window.bounds.width,
        height: window.bounds.height,
        zIndex: window.zIndex,
      }}
      onPointerDown={() => wm.focusWindow(window.id)}
    >
      <header
        onPointerDown={(e) => {
          if (
            window.state === "maximized" ||
            (e.target as HTMLElement).closest("button")
          )
            return;
          drag.current = {
            x: e.clientX,
            y: e.clientY,
            bx: window.bounds.x,
            by: window.bounds.y,
          };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={pointerMove}
        onPointerUp={() => {
          drag.current = null;
          wm.flushPersistence();
        }}
        onDoubleClick={() => wm.toggleMaximizeWindow(window.id)}
      >
        <span className={`app-symbol ${window.iconKey}`}>
          {icon(window.iconKey)}
        </span>
        <div>
          <strong>{window.title}</strong>
          <small>{app.title}</small>
        </div>
        <nav>
          <button
            aria-label={`Minimize ${window.title}`}
            onClick={() => wm.minimizeWindow(window.id)}
          >
            ―
          </button>
          <button
            aria-label={`${window.state === "maximized" ? "Restore" : "Maximize"} ${window.title}`}
            onClick={() => wm.toggleMaximizeWindow(window.id)}
          >
            □
          </button>
          <button
            aria-label={`Close ${window.title}`}
            className="danger"
            onClick={() => wm.requestCloseWindow(window.id)}
          >
            ×
          </button>
        </nav>
      </header>
      <div className="desktop-window-content">
        {app.render({
          windowId: window.id,
          resource: window.resource,
          owner: window.owner,
        })}
      </div>
      {window.state !== "maximized" &&
        (["n", "s", "e", "w", "ne", "nw", "se", "sw"] as ResizeDirection[]).map(
          (direction) => (
            <button
              key={direction}
              className={`window-resizer resize-${direction}`}
              aria-label={`Resize ${window.title} ${direction}`}
              onPointerDown={(e) => {
                size.current = {
                  x: e.clientX,
                  y: e.clientY,
                  width: window.bounds.width,
                  height: window.bounds.height,
                  direction,
                  original: { ...window.bounds },
                };
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => {
                if (size.current)
                  wm.resizeWindow(
                    window.id,
                    size.current.direction,
                    e.clientX - size.current.x,
                    e.clientY - size.current.y,
                    size.current.original,
                  );
              }}
              onPointerUp={() => {
                size.current = null;
                wm.flushPersistence();
              }}
            />
          ),
        )}
    </section>
  );
}
export function icon(key: string) {
  return (
    (
      {
        repo: "◆",
        image: "▧",
        github: "⑂",
        tool: "⌘",
        settings: "⚙",
        bin: "♲",
      } as Record<string, string>
    )[key] ?? "◇"
  );
}
