"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { CodeEditor } from "@/components/CodeEditor";
import {
  hasUnresolvedConflicts,
  parseConflictHunks,
  resolveConflictAt,
  type ConflictHunk,
  type ConflictSide,
} from "@/lib/merge";
import { stageEditDirect } from "@/features/changes/ops";
import {
  openSession,
  getSession,
  updateDraft,
  markSaved,
  discardDraft,
  isDirty,
  subscribeDirty,
} from "@/lib/editor-sessions";
import {
  CheckmarkCircleRegular,
  WarningRegular,
} from "@/features/icons";

/**
 * The dedicated conflict resolver (issue #20): opened for a `file`
 * resource exactly like the plain Code Editor — same window/application
 * model, same per-(repo, path) editor session, same
 * `stageEditDirect`/Working-Changes pipeline, same window-close scope
 * (`kind: "editor"` in the application registry gets it the identical
 * single-file close/discard/recycle-bin rules FileEditorApp already has).
 * Only the body differs: instead of one CodeMirror instance, unresolved
 * regions get their own Ours/Theirs/context card with per-region Accept
 * actions, and the full Result stays freely editable underneath.
 *
 * Resolution state is never stored separately from the text — a region
 * counts as resolved the moment its literal `<<<<<<<`/`=======`/`>>>>>>>`
 * markers are gone from the draft, whether that happened via an Accept
 * button or the user hand-editing the Result. That is what makes staging
 * safe to gate on `hasUnresolvedConflicts(draft)` alone.
 */
export function ConflictResolverView({
  repoKey,
  path,
  branch,
  initialText,
}: {
  repoKey: string;
  path: string;
  branch: string;
  initialText: string;
}) {
  const session = openSession(repoKey, path, initialText);
  const [draft, setDraft] = useState(session.draft);
  const [nonce, setNonce] = useState(0);
  const [savedFlash, setSavedFlash] = useState(false);

  const dirty = useSyncExternalStore(
    subscribeDirty,
    () => isDirty(repoKey, path),
    () => false,
  );

  // Recomputed from the live draft on every change — the single source of
  // truth for both the per-region cards and the staging gate below.
  const hunks = useMemo(() => parseConflictHunks(draft), [draft]);
  // Stable baseline so "N of M resolved" doesn't move as the user resolves
  // hunks; only changes when a fresh, non-dirty base is loaded.
  const totalHunks = useMemo(
    () => parseConflictHunks(session.baseContent).length,
    [session.baseContent],
  );
  const resolvedCount = Math.max(0, totalHunks - hunks.length);
  const blocked = hunks.length > 0;

  function applyDraft(next: string) {
    setDraft(next);
    updateDraft(repoKey, path, next);
  }

  function accept(hunk: ConflictHunk, side: ConflictSide) {
    applyDraft(resolveConflictAt(draft, hunk.id, side));
    setNonce((n) => n + 1); // remount CodeEditor so it picks up the new text
  }

  function acceptAll(side: "ours" | "theirs") {
    let next = draft;
    // Repeatedly resolve hunk 0 — after each resolution the next remaining
    // region becomes index 0, so this always converges.
    for (let i = 0; i < hunks.length; i++) {
      const [first] = parseConflictHunks(next);
      if (!first) break;
      next = resolveConflictAt(next, first.id, side);
    }
    applyDraft(next);
    setNonce((n) => n + 1);
  }

  function save() {
    if (hasUnresolvedConflicts(draft)) return; // guarded again below in the UI
    const current = getSession(repoKey, path);
    if (!current) return;
    void stageEditDirect(repoKey, path, current.draft).then(() => {
      markSaved(repoKey, path);
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 1500);
    });
  }

  function discard() {
    discardDraft(repoKey, path);
    setDraft(getSession(repoKey, path)?.draft ?? initialText);
    setNonce((n) => n + 1);
  }

  return (
    <div className="flex h-full flex-col bg-[var(--dh-surface)]">
      <div className="flex items-center gap-2 border-b border-[var(--dh-window-border)] px-3 py-1.5">
        <span className="min-w-0 truncate text-xs text-[var(--dh-text)]" title={path}>
          {path}
        </span>
        <span className="shrink-0 text-[11px] text-[var(--dh-text-secondary)]">
          {branch}
          {dirty ? " · unsaved draft" : ""}
          {savedFlash ? " · saved as Working Change" : ""}
        </span>
        {totalHunks > 0 && (
          <span
            className={[
              "ml-auto flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
              blocked
                ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
            ].join(" ")}
          >
            {blocked ? (
              <WarningRegular width={12} height={12} />
            ) : (
              <CheckmarkCircleRegular width={12} height={12} />
            )}
            {resolvedCount} of {totalHunks} regions resolved
          </span>
        )}
        <div className="flex shrink-0 items-center gap-1.5">
          {hunks.length > 1 && (
            <>
              <button
                onClick={() => acceptAll("ours")}
                className="rounded border border-[var(--dh-window-border)] px-2 py-0.5 text-[11px] text-[var(--dh-text-secondary)] hover:border-[var(--dh-window-border-active)]"
                title="Accept Current (Ours) for every remaining region"
              >
                Accept all Ours
              </button>
              <button
                onClick={() => acceptAll("theirs")}
                className="rounded border border-[var(--dh-window-border)] px-2 py-0.5 text-[11px] text-[var(--dh-text-secondary)] hover:border-[var(--dh-window-border-active)]"
                title="Accept Incoming (Theirs) for every remaining region"
              >
                Accept all Theirs
              </button>
            </>
          )}
          <button
            onClick={save}
            disabled={blocked}
            title={
              blocked
                ? `Resolve ${hunks.length} remaining conflict region${hunks.length === 1 ? "" : "s"} before saving`
                : "Save as Working Change (Ctrl/Cmd+S)"
            }
            className="rounded bg-[var(--dh-accent)] px-2 py-0.5 text-[11px] font-medium text-[var(--dh-accent-foreground)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Save
          </button>
          <button
            onClick={discard}
            disabled={!dirty}
            className="rounded border border-[var(--dh-window-border)] px-2 py-0.5 text-[11px] text-[var(--dh-text-secondary)] hover:border-[var(--dh-window-border-active)] disabled:opacity-40"
          >
            Discard draft
          </button>
        </div>
      </div>

      {blocked && (
        <div className="border-b border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 px-3 py-1.5 text-[11px] text-amber-800 dark:text-amber-300">
          {hunks.length} conflict region{hunks.length === 1 ? "" : "s"} still contain
          unresolved markers — staging and checkpoints are blocked for this file until
          every region is resolved.
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto">
        {hunks.length === 0 ? (
          <div className="p-3 text-[12px] text-[var(--dh-text-secondary)]">
            {totalHunks > 0
              ? "All conflict regions are resolved. Review the result below, then Save."
              : "No conflict markers found in this file."}
          </div>
        ) : (
          <div className="flex flex-col gap-2 p-3">
            {hunks.map((hunk, i) => (
              <ConflictCard key={hunk.id} index={i} hunk={hunk} onAccept={accept} />
            ))}
          </div>
        )}
        <div className="border-t border-[var(--dh-window-border)] px-3 pb-1 pt-2">
          <div className="mb-1 text-[11px] font-medium text-[var(--dh-text-secondary)]">
            Result (editable)
          </div>
        </div>
        <div className="h-72 min-h-0 border-t border-[var(--dh-window-border)]">
          <CodeEditor
            key={`${repoKey}:${path}:${nonce}`}
            path={path}
            initialValue={draft}
            onChange={(value) => applyDraft(value)}
            onSave={save}
          />
        </div>
      </div>
    </div>
  );
}

function ConflictCard({
  index,
  hunk,
  onAccept,
}: {
  index: number;
  hunk: ConflictHunk;
  onAccept: (hunk: ConflictHunk, side: ConflictSide) => void;
}) {
  return (
    <div className="rounded-lg border border-[var(--dh-window-border)] bg-[var(--dh-surface-raised)]">
      <div className="flex items-center gap-2 border-b border-[var(--dh-window-border)] px-2.5 py-1">
        <WarningRegular width={12} height={12} className="text-amber-700 dark:text-amber-400" />
        <span className="text-[11px] font-medium text-[var(--dh-text)]">
          Region {index + 1}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => onAccept(hunk, "ours")}
            className="rounded border border-[var(--dh-window-border)] px-2 py-0.5 text-[11px] text-[var(--dh-text-secondary)] hover:border-[var(--dh-window-border-active)]"
          >
            Accept Current
          </button>
          <button
            onClick={() => onAccept(hunk, "theirs")}
            className="rounded border border-[var(--dh-window-border)] px-2 py-0.5 text-[11px] text-[var(--dh-text-secondary)] hover:border-[var(--dh-window-border-active)]"
          >
            Accept Incoming
          </button>
          <button
            onClick={() => onAccept(hunk, "both")}
            className="rounded border border-[var(--dh-window-border)] px-2 py-0.5 text-[11px] text-[var(--dh-text-secondary)] hover:border-[var(--dh-window-border-active)]"
          >
            Keep Both
          </button>
        </div>
      </div>
      {hunk.before.length > 0 && (
        <pre className="overflow-x-auto px-2.5 pt-1.5 font-mono text-[11px] text-[var(--dh-text-disabled)]">
          {hunk.before.join("\n")}
        </pre>
      )}
      <div className="grid grid-cols-2 gap-px bg-[var(--dh-window-border)]">
        <div className="bg-[var(--dh-surface)] p-2">
          <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-[var(--dh-text-secondary)]">
            Current (Ours)
          </div>
          <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-[11px] text-[var(--dh-text)]">
            {hunk.ours.join("\n") || "(empty)"}
          </pre>
        </div>
        <div className="bg-[var(--dh-surface)] p-2">
          <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-[var(--dh-text-secondary)]">
            Incoming (Theirs)
          </div>
          <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-[11px] text-[var(--dh-text)]">
            {hunk.theirs.join("\n") || "(empty)"}
          </pre>
        </div>
      </div>
    </div>
  );
}
