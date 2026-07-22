"use client";
import { useRef, useState } from "react";
import { Tooltip } from "@fluentui/react-components";
import { appIconFor, DismissRegular, DraghubMark } from "@/features/icons";
import { useStore } from "@/lib/store";
import { useSearch } from "@/features/search";
import { useWindowManager } from "./WindowManagerProvider";

/**
 * The Dock: a persistent, left-edge shelf of pinned repositories.
 *
 * Distinct from the Taskbar (which reflects whatever windows currently
 * happen to be open, grouped and ordered by recency): the Dock reflects
 * favorites the user deliberately kept one click away, whether or not that
 * repository is currently open — the same distinction a macOS Dock draws
 * against its own window switcher. Pins survive closing the repository's
 * windows (MULTI_REPO_WINDOW_DOCK_SPEC.md §8).
 */
export function Dock() {
  const { state, togglePinRepo, reorderPinnedRepos } = useStore();
  const wm = useWindowManager();
  const search = useSearch();
  const pinned = state.pinnedRepoKeys;
  const dragIndex = useRef<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const RepoIcon = appIconFor("repo");

  function groupIsOpen(repoKey: string) {
    const lower = repoKey.toLowerCase();
    return wm.session.windows.some(
      (w) => w.groupKey.toLowerCase() === lower && !w.minimized,
    );
  }
  function groupIsRunning(repoKey: string) {
    const lower = repoKey.toLowerCase();
    return wm.session.windows.some((w) => w.groupKey.toLowerCase() === lower);
  }

  function open(repoKey: string) {
    wm.openOrFocusWindow({
      applicationId: "repository-explorer",
      owner: { type: "desktop" },
      resource: { type: "repository", repoKey },
      title: repoKey,
    });
  }

  function drop(target: number) {
    const from = dragIndex.current;
    dragIndex.current = null;
    setOverIndex(null);
    if (from === null || from === target) return;
    const next = [...pinned];
    const [moved] = next.splice(from, 1);
    next.splice(target, 0, moved);
    reorderPinnedRepos(next);
  }

  return (
    <nav className="desktop-dock" aria-label="Dock">
      <Tooltip content="Start Menu (Ctrl/Cmd+K)" relationship="label">
        <button className="dock-start" onClick={search.open} aria-label="Start Menu">
          <DraghubMark />
        </button>
      </Tooltip>
      {pinned.length > 0 && <div className="dock-divider" aria-hidden="true" />}
      <div className="dock-pins">
        {pinned.length === 0 && (
          <p className="dock-empty">
            Pin a repository from the Start Menu to keep it here.
          </p>
        )}
        {pinned.map((repoKey, index) => (
          <div
            key={repoKey}
            className={`dock-item${overIndex === index ? " drag-over" : ""}`}
            draggable
            onDragStart={() => {
              dragIndex.current = index;
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setOverIndex(index);
            }}
            onDragLeave={() =>
              setOverIndex((v) => (v === index ? null : v))
            }
            onDrop={() => drop(index)}
            onDragEnd={() => {
              dragIndex.current = null;
              setOverIndex(null);
            }}
          >
            <Tooltip content={repoKey} relationship="label">
              <button onClick={() => open(repoKey)} aria-label={`Open ${repoKey}`}>
                <RepoIcon />
                {groupIsRunning(repoKey) && (
                  <span
                    className={`dot${groupIsOpen(repoKey) ? " active" : ""}`}
                    aria-hidden="true"
                  />
                )}
              </button>
            </Tooltip>
            <button
              className="dock-unpin"
              aria-label={`Unpin ${repoKey}`}
              onClick={() => togglePinRepo(repoKey)}
            >
              <DismissRegular />
            </button>
          </div>
        ))}
      </div>
    </nav>
  );
}
