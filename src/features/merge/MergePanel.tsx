"use client";

import { useState } from "react";
import { useMergeSession } from "./merge-session";
import { conflictCountFor, type FileMergePlan } from "./plan";
import { GitBranch, Spinner, X, Trash, FilePlus, Edit } from "@/components/icons";
import type { ConflictResolution } from "@/lib/merge";

function planLabel(plan: FileMergePlan): { text: string; className: string; icon: React.ReactNode } {
  if (plan.status === "clean") {
    if (plan.action === "add")
      return { text: "add", className: "bg-emerald-500/20 text-emerald-400", icon: <FilePlus width={12} height={12} /> };
    if (plan.action === "delete")
      return { text: "delete", className: "bg-red-500/20 text-red-400", icon: <Trash width={12} height={12} /> };
    if (plan.action === "modify")
      return { text: "modify", className: "bg-amber-500/20 text-amber-400", icon: <Edit width={12} height={12} /> };
    return { text: "no-op", className: "bg-neutral-700/40 text-neutral-500", icon: null };
  }
  return { text: "conflict", className: "bg-red-500/20 text-red-400", icon: null };
}

export function MergePanel({ onClose }: { onClose: () => void }) {
  const session = useMergeSession();
  const [expanded, setExpanded] = useState<string | null>(null);

  const phase = session.phase;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-neutral-700 bg-neutral-900 shadow-2xl">
        <div className="flex items-center gap-2 border-b border-neutral-800 px-4 py-3">
          <GitBranch width={18} height={18} className="text-blue-400" />
          <h2 className="text-sm font-semibold text-neutral-100">Merge a variant</h2>
          <button
            onClick={onClose}
            className="ml-auto flex h-8 w-8 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
          >
            <X width={16} height={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {phase.phase === "error" && (
            <div className="rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-300">
              {phase.error}
            </div>
          )}

          {phase.phase === "loading" && (
            <div className="flex flex-col items-center gap-2 p-8 text-neutral-400">
              <Spinner width={20} height={20} className="text-blue-400" />
              {phase.total > 1 ? `Comparing files… ${phase.done}/${phase.total}` : "Finding merge base…"}
            </div>
          )}

          {phase.phase === "picking" && (
            <div>
              <p className="mb-3 text-sm text-neutral-400">
                Choose a branch to merge into the current variant:
              </p>
              <div className="flex flex-wrap gap-2">
                {phase.branches.map((b) => (
                  <button
                    key={b}
                    onClick={() => void session.selectBranch(b)}
                    className="flex items-center gap-1.5 rounded-full border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-neutral-200 hover:border-blue-600"
                  >
                    <GitBranch width={13} height={13} className="text-neutral-500" />
                    {b}
                  </button>
                ))}
                {phase.branches.length === 0 && (
                  <p className="text-sm text-neutral-600">No other branches to merge from.</p>
                )}
              </div>
            </div>
          )}

          {(phase.phase === "review" || phase.phase === "applying") && session.preview && (
            <div className="space-y-2">
              <p className="text-xs text-neutral-500">
                Merging <span className="text-neutral-300">{session.preview.theirsBranch}</span> —{" "}
                {session.preview.plans.length} file
                {session.preview.plans.length === 1 ? "" : "s"} touched since the merge base.
              </p>
              {session.preview.plans.length === 0 && (
                <p className="rounded-lg border border-dashed border-neutral-800 px-4 py-8 text-center text-sm text-neutral-600">
                  Nothing to merge — both variants agree on every file.
                </p>
              )}
              {session.preview.plans.map((plan) => {
                const label = planLabel(plan);
                const isOpen = expanded === plan.path;
                const resolved = session.isFullyResolved(plan);
                return (
                  <div key={plan.path} className="rounded-lg border border-neutral-800">
                    <button
                      onClick={() =>
                        setExpanded(isOpen ? null : plan.status === "conflict" ? plan.path : null)
                      }
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
                    >
                      <span
                        className={["flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium", label.className].join(
                          " "
                        )}
                      >
                        {label.icon}
                        {label.text}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-neutral-200">{plan.path}</span>
                      {plan.status === "conflict" && (
                        <span
                          className={[
                            "text-[11px]",
                            resolved ? "text-emerald-400" : "text-amber-400",
                          ].join(" ")}
                        >
                          {resolved ? "resolved" : `${conflictCountFor(plan)} to resolve`}
                        </span>
                      )}
                    </button>
                    {isOpen && plan.status === "conflict" && (
                      <div className="border-t border-neutral-800 p-3">
                        <ConflictResolver plan={plan} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {phase.phase === "done" && (
            <div className="rounded-lg border border-green-900/50 bg-green-950/30 px-4 py-3 text-sm text-green-300">
              Staged {phase.staged} file{phase.staged === 1 ? "" : "s"} as working changes. Open
              &quot;Changes&quot; to review and create a checkpoint.
            </div>
          )}
        </div>

        {(phase.phase === "review" || phase.phase === "applying") && session.preview && (
          <div className="flex items-center justify-end gap-2 border-t border-neutral-800 px-4 py-3">
            <button
              onClick={() => void session.apply()}
              disabled={
                phase.phase === "applying" ||
                session.preview.plans.length === 0 ||
                !session.preview.plans.every((p) => session.isFullyResolved(p))
              }
              className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {phase.phase === "applying" && <Spinner width={14} height={14} />}
              Stage merged files
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ConflictResolver({ plan }: { plan: Extract<FileMergePlan, { status: "conflict" }> }) {
  const session = useMergeSession();

  if (plan.kind === "delete-modify") {
    const res = session.resolutions[plan.path];
    const choice = res?.kind === "delete-modify" ? res.choice : null;
    return (
      <div className="space-y-2 text-sm">
        <p className="text-neutral-400">
          {plan.deletedBy === "ours" ? "This variant deleted this file" : "The other variant deleted this file"},
          but the other side modified it. Keep the modified version, or delete it?
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => session.setDeleteChoice(plan.path, "keep")}
            className={[
              "rounded-md border px-3 py-1.5 text-sm",
              choice === "keep" ? "border-emerald-500 bg-emerald-500/10 text-emerald-300" : "border-neutral-700 text-neutral-300",
            ].join(" ")}
          >
            Keep modified version
          </button>
          <button
            onClick={() => session.setDeleteChoice(plan.path, "delete")}
            className={[
              "rounded-md border px-3 py-1.5 text-sm",
              choice === "delete" ? "border-red-500 bg-red-500/10 text-red-300" : "border-neutral-700 text-neutral-300",
            ].join(" ")}
          >
            Delete file
          </button>
        </div>
      </div>
    );
  }

  const conflictHunks = plan.mergeResult.hunks
    .map((h, i) => ({ hunk: h, index: i }))
    .filter((x) => x.hunk.kind === "conflict");
  const res = session.resolutions[plan.path];
  const hunkResolutions = res?.kind === "hunks" ? res.hunkResolutions : [];

  let conflictOrdinal = -1;

  return (
    <div className="space-y-3 text-[13px]">
      {plan.mergeResult.hunks.map((hunk, i) => {
        if (hunk.kind !== "conflict") {
          if (hunk.lines.length === 0) return null;
          return (
            <pre key={i} className="max-h-20 overflow-hidden whitespace-pre-wrap text-neutral-600">
              {hunk.lines.slice(0, 3).join("\n")}
              {hunk.lines.length > 3 ? "\n…" : ""}
            </pre>
          );
        }
        conflictOrdinal++;
        const ord = conflictOrdinal;
        const current = hunkResolutions[ord] ?? null;
        return (
          <div key={i} className="rounded-md border border-neutral-800">
            <div className="grid grid-cols-2 divide-x divide-neutral-800 text-xs">
              <div className="p-2">
                <div className="mb-1 font-medium text-blue-400">Ours</div>
                <pre className="whitespace-pre-wrap text-neutral-300">
                  {hunk.oursLines.join("\n") || "(empty)"}
                </pre>
              </div>
              <div className="p-2">
                <div className="mb-1 font-medium text-violet-400">Theirs</div>
                <pre className="whitespace-pre-wrap text-neutral-300">
                  {hunk.theirsLines.join("\n") || "(empty)"}
                </pre>
              </div>
            </div>
            <div className="flex gap-1 border-t border-neutral-800 p-1.5">
              {(["ours", "theirs", "both"] as ConflictResolution[]).map((choice) => (
                <button
                  key={choice}
                  onClick={() => session.setHunkResolution(plan.path, ord, choice)}
                  className={[
                    "rounded px-2 py-1 text-xs capitalize",
                    current === choice
                      ? "bg-blue-600 text-white"
                      : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200",
                  ].join(" ")}
                >
                  {choice}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
