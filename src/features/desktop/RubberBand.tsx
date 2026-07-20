"use client";
import { useMemo } from "react";
import { useWindowManager } from "./WindowManagerProvider";
import type { WindowResource } from "./types";
const items = [
  "Code",
  "Pull Requests",
  "Issues",
  "Actions",
  "Security",
  "Changes",
  "Settings",
];
export function RubberBand({
  windowId,
  resource,
}: {
  windowId: string;
  resource: WindowResource;
}) {
  const wm = useWindowManager();
  const repoKey = resource.type === "repository" ? resource.repoKey : "";
  const state = wm.session.rubberBands.find(
    (r) => r.repositoryWindowId === windowId,
  ) ?? {
    repoKey,
    repositoryWindowId: windowId,
    edge: "top" as const,
    collapsed: false,
    autoHide: false,
    itemOrder: items,
  };
  const ordered = useMemo(
    () => (state.itemOrder.length ? state.itemOrder : items),
    [state.itemOrder],
  );
  return (
    <div className={`rubber-band ${state.collapsed ? "collapsed" : ""}`}>
      <button
        className="rubber-toggle"
        aria-label={
          state.collapsed
            ? "Expand repository band"
            : "Collapse repository band"
        }
        onClick={() =>
          wm.setRubberBand({ ...state, collapsed: !state.collapsed })
        }
      >
        ⌄
      </button>
      {!state.collapsed &&
        ordered.map((label) => (
          <button
            key={label}
            onClick={() => {
              if (label === "Code") return;
              const featureId = label.toLowerCase().replaceAll(" ", "-");
              wm.openRepositoryChild(
                windowId,
                "github-feature",
                { type: "github-feature", repoKey, featureId },
                `${repoKey.split("/").pop()} ${label} — Demo`,
              );
            }}
          >
            {label}
          </button>
        ))}
    </div>
  );
}
