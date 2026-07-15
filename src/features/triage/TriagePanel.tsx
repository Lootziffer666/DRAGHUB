"use client";

import { useEffect, useMemo, useState } from "react";
import { usePulls } from "@/features/pulls";
import type { PrClass } from "@/features/pulls";
import { Spinner, X, Trash, GitBranch } from "@/components/icons";

const CLASS_STYLE: Record<PrClass, string> = {
  clean: "bg-emerald-500/20 text-emerald-400",
  conflict: "bg-red-500/20 text-red-400",
  failing: "bg-orange-500/20 text-orange-400",
  "needs-review": "bg-amber-500/20 text-amber-400",
  "spam-suspect": "bg-violet-500/20 text-violet-400",
};

type PendingAction =
  | { kind: "close"; deleteBranches: boolean }
  | { kind: "label"; label: string }
  | { kind: "review"; reviewer: string };

export function TriagePanel({ onClose }: { onClose: () => void }) {
  const pulls = usePulls();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [focusIndex, setFocusIndex] = useState(0);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [labelDraft, setLabelDraft] = useState("");
  const [reviewerDraft, setReviewerDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    if (pulls.status === "idle") void pulls.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        setFocusIndex((i) => Math.min(i + 1, pulls.items.length - 1));
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        setFocusIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === " " || e.key === "x") {
        e.preventDefault();
        const pr = pulls.items[focusIndex];
        if (pr) toggle(pr.number);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusIndex, pulls.items]);

  function toggle(number: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(number)) next.delete(number);
      else next.add(number);
      return next;
    });
  }

  function selectByClass(cls: PrClass) {
    setSelected(new Set(pulls.items.filter((p) => pulls.classify(p) === cls).map((p) => p.number)));
  }

  const selectedList = useMemo(
    () => pulls.items.filter((p) => selected.has(p.number)),
    [pulls.items, selected]
  );

  async function execute(action: PendingAction) {
    setBusy(true);
    setResult(null);
    let done = 0;
    let failed = 0;
    for (const pr of selectedList) {
      let ok = false;
      if (action.kind === "close") ok = (await pulls.close(pr.number, action.deleteBranches)).ok;
      else if (action.kind === "label") ok = (await pulls.label(pr.number, [action.label])).ok;
      else ok = (await pulls.requestReview(pr.number, [action.reviewer])).ok;
      if (ok) done++;
      else failed++;
    }
    setBusy(false);
    setPending(null);
    setSelected(new Set());
    const verb =
      action.kind === "close"
        ? `Closed ${done} PR${done === 1 ? "" : "s"}${action.deleteBranches ? ` and deleted ${done} branch${done === 1 ? "" : "es"}` : ""}`
        : action.kind === "label"
          ? `Labeled ${done} PR${done === 1 ? "" : "s"} "${action.label}"`
          : `Requested review from ${action.reviewer} on ${done} PR${done === 1 ? "" : "s"}`;
    setResult(`${verb}${failed > 0 ? ` — ${failed} failed` : ""}.`);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-neutral-700 bg-neutral-900 shadow-2xl">
        <div className="flex items-center gap-2 border-b border-neutral-800 px-4 py-3">
          <GitBranch width={18} height={18} className="text-blue-400" />
          <h2 className="text-sm font-semibold text-neutral-100">Triage</h2>
          <span className="text-xs text-neutral-500">↑/↓ or j/k to move · Space to select</span>
          <button
            onClick={onClose}
            className="ml-auto flex h-8 w-8 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
          >
            <X width={16} height={16} />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-neutral-800 px-4 py-2 text-xs">
          <span className="text-neutral-500">Quick select:</span>
          {(["spam-suspect", "conflict", "failing", "needs-review", "clean"] as PrClass[]).map((cls) => (
            <button
              key={cls}
              onClick={() => selectByClass(cls)}
              className={["rounded px-1.5 py-0.5 font-medium", CLASS_STYLE[cls]].join(" ")}
            >
              all {cls}
            </button>
          ))}
          <button
            onClick={() => setSelected(new Set())}
            className="ml-auto rounded px-1.5 py-0.5 text-neutral-500 hover:text-neutral-300"
          >
            Clear selection
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {pulls.status === "loading" && (
            <div className="flex items-center gap-2 p-6 text-neutral-400">
              <Spinner width={16} height={16} className="text-blue-400" /> Loading pull requests…
            </div>
          )}
          {pulls.status === "loaded" && pulls.items.length === 0 && (
            <p className="p-6 text-center text-sm text-neutral-600">No open pull requests.</p>
          )}
          {pulls.items.map((pr, i) => {
            const cls = pulls.classify(pr);
            const isSelected = selected.has(pr.number);
            const isFocused = i === focusIndex;
            return (
              <div
                key={pr.number}
                onClick={() => setFocusIndex(i)}
                className={[
                  "flex cursor-pointer items-center gap-2 border-b border-neutral-800/60 px-4 py-2 text-sm",
                  isFocused ? "bg-neutral-800/60" : "",
                ].join(" ")}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggle(pr.number)}
                  className="h-4 w-4 rounded border-neutral-600 bg-neutral-900"
                />
                <span className={["rounded px-1.5 py-0.5 text-[11px] font-medium", CLASS_STYLE[cls]].join(" ")}>
                  {cls}
                </span>
                <span className="min-w-0 flex-1 truncate text-neutral-200">
                  #{pr.number} {pr.title}
                </span>
                <span className="shrink-0 text-[11px] text-neutral-500">{pr.authorLogin}</span>
              </div>
            );
          })}
        </div>

        {result && (
          <div className="border-t border-neutral-800 bg-green-950/30 px-4 py-2 text-sm text-green-300">
            {result}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-neutral-800 px-4 py-3">
          <span className="text-xs text-neutral-500">{selected.size} selected</span>
          <button
            onClick={() => setPending({ kind: "close", deleteBranches: true })}
            disabled={selected.size === 0 || busy}
            className="flex items-center gap-1 rounded-md border border-red-700 px-3 py-1.5 text-xs text-red-300 hover:bg-red-950/40 disabled:opacity-40"
          >
            <Trash width={13} height={13} /> Close + delete branch
          </button>
          <button
            onClick={() => setPending({ kind: "close", deleteBranches: false })}
            disabled={selected.size === 0 || busy}
            className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:border-neutral-600 disabled:opacity-40"
          >
            Close only
          </button>
          <div className="flex items-center gap-1">
            <input
              value={labelDraft}
              onChange={(e) => setLabelDraft(e.target.value)}
              placeholder="label"
              className="w-24 rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-xs text-neutral-100 outline-none focus:border-blue-600"
            />
            <button
              onClick={() => labelDraft.trim() && setPending({ kind: "label", label: labelDraft.trim() })}
              disabled={selected.size === 0 || busy || !labelDraft.trim()}
              className="rounded-md border border-neutral-700 px-2 py-1.5 text-xs text-neutral-300 hover:border-neutral-600 disabled:opacity-40"
            >
              Bulk label
            </button>
          </div>
          <div className="flex items-center gap-1">
            <input
              value={reviewerDraft}
              onChange={(e) => setReviewerDraft(e.target.value)}
              placeholder="reviewer"
              className="w-24 rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-xs text-neutral-100 outline-none focus:border-blue-600"
            />
            <button
              onClick={() => reviewerDraft.trim() && setPending({ kind: "review", reviewer: reviewerDraft.trim() })}
              disabled={selected.size === 0 || busy || !reviewerDraft.trim()}
              className="rounded-md border border-neutral-700 px-2 py-1.5 text-xs text-neutral-300 hover:border-neutral-600 disabled:opacity-40"
            >
              Bulk request review
            </button>
          </div>
        </div>

        {pending && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-md rounded-xl border border-neutral-700 bg-neutral-900 p-4 shadow-2xl">
              <p className="text-sm text-neutral-200">
                {pending.kind === "close" &&
                  `${selectedList.length} PR${selectedList.length === 1 ? "" : "s"} will be closed${
                    pending.deleteBranches
                      ? `, and ${selectedList.length} branch${selectedList.length === 1 ? "" : "es"} will be deleted`
                      : ""
                  }.`}
                {pending.kind === "label" &&
                  `${selectedList.length} PR${selectedList.length === 1 ? "" : "s"} will be labeled "${pending.label}".`}
                {pending.kind === "review" &&
                  `${pending.reviewer} will be requested to review ${selectedList.length} PR${selectedList.length === 1 ? "" : "s"}.`}
              </p>
              {pending.kind === "close" && pending.deleteBranches && (
                <p className="mt-2 text-xs text-amber-400">This cannot be undone from here.</p>
              )}
              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={() => setPending(null)}
                  className="rounded-md px-3 py-1.5 text-sm text-neutral-400 hover:bg-neutral-800"
                >
                  Cancel
                </button>
                <button
                  onClick={() => void execute(pending)}
                  disabled={busy}
                  className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
                >
                  {busy && <Spinner width={14} height={14} />}
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
