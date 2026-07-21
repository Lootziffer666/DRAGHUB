"use client";
import { useMemo } from "react";
import { ChevronDownRegular, ChevronUpRegular, appIconFor, type AppIconKey } from "@/features/icons";
import { useWindowManager } from "./WindowManagerProvider";
import type { WindowResource } from "./types";
const items = [
  "Code",
  "Pull Requests",
  "Issues",
  "Actions",
  "Triage",
  "Releases",
  "Security",
  "Changes",
  "Settings",
];
const itemIconKeys: Record<string, AppIconKey> = {
  Code: "code",
  "Pull Requests": "pull-requests",
  Issues: "issues",
  Actions: "actions",
  Triage: "triage",
  Releases: "releases",
  Security: "security",
  Changes: "changes",
  Settings: "settings",
};
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
    () =>
      state.itemOrder.length
        ? // Persisted orders from older sessions may miss newly added items —
          // append those at the end instead of hiding them.
          [
            ...state.itemOrder,
            ...items.filter((i) => !state.itemOrder.includes(i)),
          ]
        : items,
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
        {state.collapsed ? <ChevronDownRegular /> : <ChevronUpRegular />}
      </button>
      {!state.collapsed &&
        ordered.map((label) => {
          const Icon = appIconFor(itemIconKeys[label] ?? "code");
          return (
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
              <Icon /> {label}
            </button>
          );
        })}
    </div>
  );
}
