"use client";
import { useState } from "react";
import { useEffect, useSyncExternalStore } from "react";
import { groupTaskbar } from "./window-state";
import { icon } from "./WindowFrame";
import { useWindowManager } from "./WindowManagerProvider";
import { useSearch } from "@/features/search";
import {
  repoKeysWithChanges,
  changesFor,
  subscribeChanges,
} from "@/features/changes/store";
export function Taskbar() {
  const wm = useWindowManager();
  const search = useSearch();
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const pendingTotal = useSyncExternalStore(
    subscribeChanges,
    () =>
      repoKeysWithChanges().reduce((n, k) => n + changesFor(k).length, 0),
    () => 0,
  );
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
        aria-label="Open scratchpad"
        onClick={() =>
          wm.openOrFocusWindow({
            applicationId: "tool-window",
            owner: { type: "desktop" },
            resource: { type: "tool", toolId: "scratchpad" },
            title: "Scratchpad",
          })
        }
      >
        ◈
      </button>
      <button
        className="search-launch"
        onClick={search.open}
        title="Search repositories (Ctrl/Cmd+K)"
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
        <span>CHANGES</span>
        <b>{pendingTotal > 0 ? `${pendingTotal} pending` : "clean"}</b>
      </div>
      <div className="task-status" aria-label="Local desktop status">
        LOCAL
      </div>
    </footer>
  );
}
