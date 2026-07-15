"use client";

import { useStore } from "@/lib/store";
import { useDock } from "./dock-store";
import { GithubMark, Pin, GitBranch, FileText } from "@/components/icons";

function formatResetIn(resetAt: number): string {
  const mins = Math.max(0, Math.round((resetAt - Date.now()) / 60000));
  if (mins <= 0) return "resets soon";
  if (mins < 60) return `resets in ${mins}m`;
  return `resets in ${Math.round(mins / 60)}h`;
}

export function Dock() {
  const { state, openRepo } = useStore();
  const dock = useDock();
  const meta = state.meta;

  if (dock.pins.length === 0 && !meta) return null;

  return (
    <div className="flex items-center gap-2 border-b border-neutral-800 bg-neutral-950 px-3 py-1.5">
      <div className="flex flex-1 items-center gap-1.5 overflow-x-auto">
        {dock.pins.map((fullName) => {
          const badge = dock.badges[fullName];
          const active = meta?.fullName === fullName;
          return (
            <button
              key={fullName}
              onClick={() => void openRepo(fullName)}
              title={`Open ${fullName}`}
              className={[
                "flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 text-xs",
                active
                  ? "border-blue-600 bg-blue-600/10 text-blue-300"
                  : "border-neutral-800 text-neutral-300 hover:border-neutral-600",
              ].join(" ")}
            >
              <GithubMark width={12} height={12} />
              {fullName}
              {typeof badge?.openPrs === "number" && badge.openPrs > 0 && (
                <span className="flex items-center gap-0.5 rounded-full bg-neutral-800 px-1.5 text-[10px] text-neutral-300">
                  <GitBranch width={10} height={10} />
                  {badge.openPrs}
                </span>
              )}
              {typeof badge?.openIssues === "number" && badge.openIssues > 0 && (
                <span className="flex items-center gap-0.5 rounded-full bg-neutral-800 px-1.5 text-[10px] text-neutral-300">
                  <FileText width={10} height={10} />
                  {badge.openIssues}
                </span>
              )}
            </button>
          );
        })}
        {meta && !dock.isPinned(meta.fullName) && (
          <button
            onClick={() => dock.togglePin(meta.fullName)}
            title="Pin this repository to the Dock"
            className="flex shrink-0 items-center gap-1 rounded-md border border-dashed border-neutral-700 px-2 py-1 text-xs text-neutral-500 hover:border-neutral-500 hover:text-neutral-300"
          >
            <Pin width={11} height={11} /> Pin {meta.fullName}
          </button>
        )}
        {meta && dock.isPinned(meta.fullName) && (
          <button
            onClick={() => dock.togglePin(meta.fullName)}
            title="Unpin this repository"
            className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs text-neutral-600 hover:text-red-400"
          >
            <Pin width={11} height={11} /> Unpin
          </button>
        )}
      </div>
      {dock.rateLimit && (
        <span
          className={[
            "shrink-0 text-[11px]",
            dock.rateLimit.remaining < 100 ? "text-amber-400" : "text-neutral-600",
          ].join(" ")}
          title="GitHub API rate limit budget"
        >
          {dock.rateLimit.remaining}/{dock.rateLimit.limit} requests ·{" "}
          {formatResetIn(dock.rateLimit.resetAt)}
        </span>
      )}
    </div>
  );
}
