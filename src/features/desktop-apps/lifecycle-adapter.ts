import type {
  DesktopWindowState,
  RecycleBinEntry,
  RecycleBinLifecycleAdapter,
  WindowCloseBlocker,
  WindowLifecycleAdapter,
} from "@/features/desktop/types";
import {
  dirtySessionsFor,
  discardDraft,
  openSession,
  updateDraft,
  isDirty,
  getSession,
} from "@/lib/editor-sessions";
import { changesFor } from "@/features/changes/store";
import {
  checkpointRepo,
  discardBucketToBin,
  stageEditDirect,
} from "@/features/changes/ops";
import { getGithubToken, languageFromPath } from "@/lib/github";
import { hasUnresolvedConflicts, parseConflictHunks } from "@/lib/merge";

/**
 * Real window-close / Recycle-Bin lifecycle adapter (Stage 4 of the
 * post-PR8 integration brief). It inspects actual domain state — dirty
 * CodeMirror drafts and pending working changes — and resolves closes by
 * committing a checkpoint or by moving recoverable content into the bins:
 * unsaved editor drafts become kernel Recycle-Bin `draft` entries (restored
 * back into editor sessions through this adapter), while staged working
 * changes go to the domain retention store in `src/lib/recycle-bin.ts`,
 * which the Recycle Bin window also displays. Domain logic stays here; the
 * window manager only orchestrates the transaction.
 */

/** Resolves a (possibly differently-cased) repo key to the canonical key
 * the domain stores use, plus the loaded repository meta. */
type RepoResolver = (
  repoKey: string
) => { key: string; meta: { owner: string; repo: string; branch: string } } | null;

/**
 * A window's close-domain scope: exactly what a close/discard transaction is
 * allowed to touch. Derived once from a window and reused by both
 * `inspectClose` (per window in the transaction) and `resolveClose` (for the
 * target) so inspection and resolution can never disagree about scope.
 *
 * - "repository": the whole repository — every dirty draft and the repo's
 *   Working Changes bucket.
 * - "editor": exactly one file's draft. Never touches other drafts or the
 *   repository's Working Changes bucket, never checkpoints.
 * - "viewer": nothing. A viewer is never blocked and never mutates domain
 *   state on close.
 * - "none": any other application/system/tool window — no implicit
 *   repo-wide draft or Working Change behavior.
 */
export type CloseScope =
  | { mode: "repository"; repoKey: string }
  | { mode: "editor"; repoKey: string; path: string }
  | { mode: "viewer"; repoKey: string; path: string }
  | { mode: "none" };

export function deriveCloseScope(target: DesktopWindowState): CloseScope {
  if (target.kind === "repository" && target.resource.type === "repository") {
    return { mode: "repository", repoKey: target.resource.repoKey };
  }
  if (target.kind === "editor" && target.resource.type === "file") {
    return { mode: "editor", repoKey: target.resource.repoKey, path: target.resource.path };
  }
  if (target.kind === "viewer" && target.resource.type === "file") {
    return { mode: "viewer", repoKey: target.resource.repoKey, path: target.resource.path };
  }
  return { mode: "none" };
}

export function createDesktopLifecycleAdapter(
  resolveRepo: RepoResolver
): WindowLifecycleAdapter & RecycleBinLifecycleAdapter {
  const canonical = (repoKey: string) => resolveRepo(repoKey)?.key ?? repoKey;
  return {
    async inspectClose(context) {
      const blockers: WindowCloseBlocker[] = [];
      const windows = [context.target, ...context.children];
      const seenRepos = new Set<string>();
      // Paths already owned by a child EDITOR window, so the repository-wide
      // aggregation below never double-reports them. Viewer windows own
      // nothing, so their paths are not excluded here.
      const editorChildPaths = new Set(
        windows.flatMap((w) => {
          const scope = deriveCloseScope(w);
          return scope.mode === "editor" ? [scope.path] : [];
        })
      );
      for (const w of windows) {
        const scope = deriveCloseScope(w);
        if (scope.mode === "editor") {
          // Editor: exactly its own file's draft.
          if (isDirty(canonical(scope.repoKey), scope.path)) {
            blockers.push({
              type: "unsaved-draft",
              windowId: w.id,
              label: `Unsaved draft: ${scope.path}`,
            });
          }
          continue;
        }
        // Viewer and other application/system/tool windows are never
        // draft-blocked and never contribute repo-wide inspection.
        if (scope.mode !== "repository") continue;
        const repoKey = canonical(scope.repoKey);
        if (seenRepos.has(repoKey)) continue;
        seenRepos.add(repoKey);
        // Dirty editor drafts anywhere in this repository (tab editors),
        // excluding files already covered by a child editor window above.
        for (const s of dirtySessionsFor(repoKey)) {
          if (editorChildPaths.has(s.path)) continue;
          blockers.push({
            type: "unsaved-draft",
            windowId: w.id,
            label: `Unsaved draft: ${s.path}`,
          });
        }
        const pending = changesFor(repoKey).length;
        if (pending > 0) {
          blockers.push({
            type: "working-changes",
            windowId: w.id,
            count: pending,
          });
        }
      }
      return blockers;
    },

    async resolveClose(context, resolution) {
      if (resolution.action === "cancel") return { success: false };
      if (resolution.action === "close-clean") return { success: true };

      const scope = deriveCloseScope(context.target);

      if (scope.mode === "editor") {
        const repoKey = canonical(scope.repoKey);
        if (!isDirty(repoKey, scope.path)) return { success: true };
        const session = getSession(repoKey, scope.path);
        const draft = session?.draft ?? "";
        if (resolution.action === "commit-and-close") {
          // Closing the resolver (or any editor window) via the desktop's
          // close dialog must not be a way around the resolver's own
          // Save-button gate — a draft that still contains conflict
          // markers is never staged as a Working Change (issue #20).
          if (hasUnresolvedConflicts(draft)) {
            const remaining = parseConflictHunks(draft).length;
            return {
              success: false,
              error: `Resolve ${remaining} remaining conflict region${remaining === 1 ? "" : "s"} in ${scope.path} before saving.`,
            };
          }
          // Stages ONLY this file as a Working Change — no repository
          // checkpoint, no other draft or Working Change is touched.
          await stageEditDirect(repoKey, scope.path, draft);
          discardDraft(repoKey, scope.path);
          return { success: true };
        }
        // discard-to-recycle-bin-and-close: exactly one kernel draft entry
        // for this file; every other draft and Working Change is preserved.
        const entry: RecycleBinEntry = {
          id: crypto.randomUUID(),
          kind: "draft",
          sourceWindowId: context.target.id,
          repoKey,
          path: scope.path,
          label: `Unsaved draft — ${scope.path}`,
          discardedAt: Date.now(),
          payload: { content: draft, language: languageFromPath(scope.path) },
        };
        discardDraft(repoKey, scope.path);
        return { success: true, recycleBinEntries: [entry] };
      }

      if (scope.mode !== "repository") {
        // Viewer and other application/system/tool windows: no implicit
        // repo-wide draft or Working Change behavior.
        return { success: true };
      }

      const repoKey = canonical(scope.repoKey);

      if (resolution.action === "commit-and-close") {
        // Checked before the token check: whether a conflicted draft can be
        // committed is never a question of credentials, and surfacing the
        // real blocker first avoids sending the user to Settings for a file
        // they still need to come back and resolve either way (issue #20).
        // Checked up front against every dirty draft, before staging
        // anything, so a blocked file can't leave the repository with some
        // drafts already staged and others not.
        const dirty = dirtySessionsFor(repoKey);
        const blocked = dirty.find((s) => hasUnresolvedConflicts(s.draft));
        if (blocked) {
          const remaining = parseConflictHunks(blocked.draft).length;
          return {
            success: false,
            error: `Resolve ${remaining} remaining conflict region${remaining === 1 ? "" : "s"} in ${blocked.path} before creating a checkpoint.`,
          };
        }
        if (!getGithubToken()) {
          return {
            success: false,
            error:
              "No GitHub token configured — save a PAT in Settings, or discard to the Recycle Bin instead.",
          };
        }
        // Unsaved drafts anywhere in the repository (including owned child
        // editor windows) become staged changes so the checkpoint includes them.
        for (const s of dirty) {
          await stageEditDirect(repoKey, s.path, s.draft);
          discardDraft(repoKey, s.path);
        }
        if (changesFor(repoKey).length === 0) return { success: true };
        const meta = resolveRepo(repoKey)?.meta ?? null;
        if (!meta) {
          return {
            success: false,
            error: `Repository state for ${repoKey} is not loaded — cannot create a checkpoint.`,
          };
        }
        const result = await checkpointRepo(
          repoKey,
          meta,
          `Checkpoint before closing ${context.target.title}`
        );
        if (!result.ok) return { success: false, error: result.error };
        return { success: true };
      }

      // discard-to-recycle-bin-and-close: repository drafts move to kernel
      // entries and the repository's Working Changes bucket moves to
      // retained domain storage.
      const entries: RecycleBinEntry[] = [];
      for (const s of dirtySessionsFor(repoKey)) {
        entries.push({
          id: crypto.randomUUID(),
          kind: "draft",
          sourceWindowId: context.target.id,
          repoKey,
          path: s.path,
          label: `Unsaved draft — ${s.path}`,
          discardedAt: Date.now(),
          payload: {
            content: s.draft,
            language: languageFromPath(s.path),
          },
        });
        discardDraft(repoKey, s.path);
      }
      // Staged working changes are retained in the domain Recycle Bin
      // (blobs kept in IndexedDB, 7-day grace) — shown by the same window.
      discardBucketToBin(repoKey);
      return { success: true, recycleBinEntries: entries };
    },

    async restoreEntry(entry) {
      if (entry.kind === "draft") {
        if (!entry.repoKey || !entry.path) {
          return { success: false, error: "Draft entry has no target path." };
        }
        const existing = getSession(entry.repoKey, entry.path);
        if (!existing) openSession(entry.repoKey, entry.path, "");
        updateDraft(entry.repoKey, entry.path, entry.payload.content);
        return { success: true };
      }
      return {
        success: false,
        error:
          "Working-change entries are restored from the domain Recycle Bin section below.",
      };
    },
  };
}
