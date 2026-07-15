"use client";

import { useEffect, useState } from "react";
import { usePulls } from "./pulls-store";
import type { PrClass } from "./classify";
import type { PullSummary } from "./api";
import { Spinner, X, GitBranch, ExternalLink } from "@/components/icons";

const CLASS_STYLE: Record<PrClass, string> = {
  clean: "bg-emerald-500/20 text-emerald-400",
  conflict: "bg-red-500/20 text-red-400",
  failing: "bg-orange-500/20 text-orange-400",
  "needs-review": "bg-amber-500/20 text-amber-400",
  "spam-suspect": "bg-violet-500/20 text-violet-400",
};

export function PullsPanel({ onClose }: { onClose: () => void }) {
  const pulls = usePulls();
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    if (pulls.status === "idle") void pulls.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-neutral-700 bg-neutral-900 shadow-2xl">
        <div className="flex items-center gap-2 border-b border-neutral-800 px-4 py-3">
          <GitBranch width={18} height={18} className="text-blue-400" />
          <h2 className="text-sm font-semibold text-neutral-100">Pull Requests</h2>
          <button
            onClick={() => void pulls.refresh()}
            className="ml-auto rounded-md px-2 py-1 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
          >
            Refresh
          </button>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
          >
            <X width={16} height={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {pulls.status === "loading" && (
            <div className="flex items-center gap-2 p-6 text-neutral-400">
              <Spinner width={16} height={16} className="text-blue-400" /> Loading pull requests…
            </div>
          )}
          {pulls.status === "error" && (
            <div className="rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-300">
              {pulls.error}
            </div>
          )}
          {pulls.status === "loaded" && pulls.items.length === 0 && (
            <p className="p-6 text-center text-sm text-neutral-600">No open pull requests.</p>
          )}
          <div className="space-y-2">
            {pulls.items.map((pr) => (
              <PrRow
                key={pr.number}
                pr={pr}
                isOpen={expanded === pr.number}
                onToggle={() => {
                  const next = expanded === pr.number ? null : pr.number;
                  setExpanded(next);
                  if (next !== null) void pulls.loadDetail(pr.number);
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PrRow({ pr, isOpen, onToggle }: { pr: PullSummary; isOpen: boolean; onToggle: () => void }) {
  const pulls = usePulls();
  const cls = pulls.classify(pr);
  const detail = pulls.details[pr.number];
  const checkSummary = pulls.checks[pr.number];
  const detailStatus = pulls.detailStatus[pr.number] ?? "idle";

  const [reviewerInput, setReviewerInput] = useState("");
  const [labelInput, setLabelInput] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [closeSummary, setCloseSummary] = useState(false);

  async function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true);
    setActionError(null);
    const result = await action();
    if (!result.ok) setActionError(result.error ?? "Action failed.");
    setBusy(false);
  }

  return (
    <div className="rounded-lg border border-neutral-800">
      <button onClick={onToggle} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm">
        <span className={["rounded px-1.5 py-0.5 text-[11px] font-medium", CLASS_STYLE[cls]].join(" ")}>
          {cls}
        </span>
        {pr.draft && (
          <span className="rounded bg-neutral-700/50 px-1.5 py-0.5 text-[11px] text-neutral-400">draft</span>
        )}
        <span className="min-w-0 flex-1 truncate text-neutral-200">
          #{pr.number} {pr.title}
        </span>
        <span className="shrink-0 text-[11px] text-neutral-500">{pr.authorLogin}</span>
      </button>

      {isOpen && (
        <div className="space-y-3 border-t border-neutral-800 p-3 text-[13px]">
          <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-400">
            <span className="flex items-center gap-1">
              <GitBranch width={12} height={12} /> {pr.headRef} → {pr.baseRef}
            </span>
            <a
              href={pr.htmlUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-blue-400 hover:underline"
            >
              <ExternalLink width={12} height={12} /> View on GitHub
            </a>
            {detailStatus === "loading" && <Spinner width={12} height={12} className="text-blue-400" />}
            {detail && (
              <span>
                {detail.mergeable === null
                  ? "mergeability: checking…"
                  : detail.mergeable
                    ? "mergeable"
                    : `conflicts (${detail.mergeableState})`}
              </span>
            )}
            {checkSummary && checkSummary.total > 0 && (
              <span>
                checks: {checkSummary.passing} passing, {checkSummary.failing} failing
                {checkSummary.pending > 0 ? `, ${checkSummary.pending} pending` : ""}
              </span>
            )}
            {detail && <span>{detail.additions}+/{detail.deletions}- · {detail.changedFiles} files</span>}
          </div>

          {pr.labels.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {pr.labels.map((l) => (
                <span key={l} className="rounded bg-neutral-800 px-1.5 py-0.5 text-[11px] text-neutral-300">
                  {l}
                </span>
              ))}
            </div>
          )}

          {actionError && <div className="text-xs text-red-400">{actionError}</div>}

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => run(() => pulls.merge(pr.number, "merge"))}
              disabled={busy}
              className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-500 disabled:opacity-50"
            >
              Merge
            </button>
            <button
              onClick={() => setCloseSummary(true)}
              disabled={busy}
              className="rounded-md border border-red-700 px-3 py-1.5 text-xs text-red-300 hover:bg-red-950/40 disabled:opacity-50"
            >
              Close
            </button>
            <div className="flex items-center gap-1">
              <input
                value={reviewerInput}
                onChange={(e) => setReviewerInput(e.target.value)}
                placeholder="reviewer username"
                className="w-32 rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-xs text-neutral-100 outline-none focus:border-blue-600"
              />
              <button
                onClick={() => {
                  if (!reviewerInput.trim()) return;
                  void run(() => pulls.requestReview(pr.number, [reviewerInput.trim()]));
                  setReviewerInput("");
                }}
                disabled={busy}
                className="rounded-md border border-neutral-700 px-2 py-1 text-xs text-neutral-300 hover:border-neutral-600 disabled:opacity-50"
              >
                Request review
              </button>
            </div>
            <div className="flex items-center gap-1">
              <input
                value={labelInput}
                onChange={(e) => setLabelInput(e.target.value)}
                placeholder="label"
                className="w-24 rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-xs text-neutral-100 outline-none focus:border-blue-600"
              />
              <button
                onClick={() => {
                  if (!labelInput.trim()) return;
                  void run(() => pulls.label(pr.number, [labelInput.trim()]));
                  setLabelInput("");
                }}
                disabled={busy}
                className="rounded-md border border-neutral-700 px-2 py-1 text-xs text-neutral-300 hover:border-neutral-600 disabled:opacity-50"
              >
                Add label
              </button>
            </div>
          </div>

          {closeSummary && (
            <div className="rounded-md border border-amber-800/60 bg-amber-950/30 p-2 text-xs text-amber-200">
              <p className="mb-2">
                Close PR #{pr.number} and delete branch &quot;{pr.headRef}&quot;? This cannot be undone
                from here.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setCloseSummary(false);
                    void run(() => pulls.close(pr.number, true));
                  }}
                  className="rounded bg-red-600 px-2 py-1 text-white hover:bg-red-500"
                >
                  Close + delete branch
                </button>
                <button
                  onClick={() => {
                    setCloseSummary(false);
                    void run(() => pulls.close(pr.number, false));
                  }}
                  className="rounded border border-neutral-600 px-2 py-1 text-neutral-200"
                >
                  Close only
                </button>
                <button
                  onClick={() => setCloseSummary(false)}
                  className="rounded px-2 py-1 text-neutral-400 hover:text-neutral-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
