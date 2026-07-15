"use client";

import { useEffect, useState } from "react";
import { useIssues } from "./issues-store";
import type { IssueSummary } from "./api";
import { Spinner, X, ExternalLink, FileText } from "@/components/icons";

export function IssuesPanel({ onClose }: { onClose: () => void }) {
  const issues = useIssues();
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    if (issues.status === "idle") void issues.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-neutral-700 bg-neutral-900 shadow-2xl">
        <div className="flex items-center gap-2 border-b border-neutral-800 px-4 py-3">
          <FileText width={18} height={18} className="text-blue-400" />
          <h2 className="text-sm font-semibold text-neutral-100">Issues</h2>
          <button
            onClick={() => void issues.refresh()}
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
          {issues.status === "loading" && (
            <div className="flex items-center gap-2 p-6 text-neutral-400">
              <Spinner width={16} height={16} className="text-blue-400" /> Loading issues…
            </div>
          )}
          {issues.status === "error" && (
            <div className="rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-300">
              {issues.error}
            </div>
          )}
          {issues.status === "loaded" && issues.items.length === 0 && (
            <p className="p-6 text-center text-sm text-neutral-600">No open issues.</p>
          )}
          <div className="space-y-2">
            {issues.items.map((issue) => (
              <IssueRow
                key={issue.number}
                issue={issue}
                isOpen={expanded === issue.number}
                onToggle={() => setExpanded(expanded === issue.number ? null : issue.number)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function IssueRow({
  issue,
  isOpen,
  onToggle,
}: {
  issue: IssueSummary;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const issues = useIssues();
  const [labelInput, setLabelInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

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
        <span className="min-w-0 flex-1 truncate text-neutral-200">
          #{issue.number} {issue.title}
        </span>
        {issue.commentsCount > 0 && (
          <span className="shrink-0 text-[11px] text-neutral-500">{issue.commentsCount} comments</span>
        )}
        <span className="shrink-0 text-[11px] text-neutral-500">{issue.authorLogin}</span>
      </button>

      {isOpen && (
        <div className="space-y-3 border-t border-neutral-800 p-3 text-[13px]">
          <a
            href={issue.htmlUrl}
            target="_blank"
            rel="noreferrer"
            className="flex w-fit items-center gap-1 text-xs text-blue-400 hover:underline"
          >
            <ExternalLink width={12} height={12} /> View on GitHub
          </a>
          {issue.labels.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {issue.labels.map((l) => (
                <span key={l} className="rounded bg-neutral-800 px-1.5 py-0.5 text-[11px] text-neutral-300">
                  {l}
                </span>
              ))}
            </div>
          )}
          {actionError && <div className="text-xs text-red-400">{actionError}</div>}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => run(() => issues.close(issue.number))}
              disabled={busy}
              className="rounded-md border border-red-700 px-3 py-1.5 text-xs text-red-300 hover:bg-red-950/40 disabled:opacity-50"
            >
              Close
            </button>
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
                  void run(() => issues.label(issue.number, [labelInput.trim()]));
                  setLabelInput("");
                }}
                disabled={busy}
                className="rounded-md border border-neutral-700 px-2 py-1 text-xs text-neutral-300 hover:border-neutral-600 disabled:opacity-50"
              >
                Add label
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
