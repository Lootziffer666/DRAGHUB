"use client";
import { useState } from "react";
import { useEffect } from "react";
import { groupTaskbar } from "./window-state";
import { icon } from "./WindowFrame";
import { useWindowManager } from "./WindowManagerProvider";
export function Taskbar() {
  const wm = useWindowManager();
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const orderedWindows = [...wm.session.windows].sort((a, b) => {
    return (
      wm.session.taskbarOrder.indexOf(a.id) -
      wm.session.taskbarOrder.indexOf(b.id)
    );
  });
  const groups = groupTaskbar(orderedWindows);
  useEffect(() => {
    if (openGroup && !groups.some((group) => group.key === openGroup))
      setOpenGroup(null);
  }, [groups, openGroup]);
  return (
    <footer className="desktop-taskbar">
      <button
        className="launcher"
        aria-label="Open launcher"
        onClick={() =>
          wm.openOrFocusWindow({
            applicationId: "tool-window",
            owner: { type: "desktop" },
            resource: { type: "tool", toolId: "scratchpad-unsaved" },
            title: "Scratchpad — Demo",
          })
        }
      >
        ◈
      </button>
      <button
        className="search-launch"
        onClick={() =>
          wm.openOrFocusWindow({
            applicationId: "tool-window",
            owner: { type: "desktop" },
            resource: { type: "tool", toolId: "search" },
            title: "Search — Demo",
          })
        }
      >
        ⌕ <span>Launcher / Search</span>
      </button>
      <div className="task-groups">
        {groups.map((group) => {
          const top = [...group.items].sort(
            (a, b) => b.lastFocusedAt - a.lastFocusedAt,
          )[0];
          return (
            <div className="task-group" key={group.key}>
              <button
                className={
                  group.items.some(
                    (w) => w.id === wm.session.activeWindowId && !w.minimized,
                  )
                    ? "active"
                    : ""
                }
                onClick={() =>
                  group.items.length === 1
                    ? wm.toggleMinimizeWindow(top.id)
                    : setOpenGroup(openGroup === group.key ? null : group.key)
                }
              >
                <span>{icon(top.iconKey)}</span>
                <em>
                  {top.owner.type === "repository"
                    ? top.owner.repoKey.split("/").pop()
                    : top.title}
                </em>
                {group.items.length > 1 && <i>{group.items.length}</i>}
              </button>
              {openGroup === group.key && (
                <div className="task-group-menu">
                  {group.items.map((w) => (
                    <button
                      key={w.id}
                      onClick={() => {
                        wm.toggleMinimizeWindow(w.id);
                        setOpenGroup(null);
                      }}
                    >
                      <span>{icon(w.iconKey)}</span>
                      <b>{w.title}</b>
                      <small>
                        {w.minimized
                          ? "minimized"
                          : w.id === wm.session.activeWindowId
                            ? "active"
                            : w.presentation === "maximized"
                              ? "maximized"
                              : "background"}
                      </small>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="task-jobs">
        <span>TOOLS</span>
        <b>Demo mode</b>
      </div>
      <div className="task-status" aria-label="Local desktop status">
        LOCAL
      </div>
    </footer>
  );
}
