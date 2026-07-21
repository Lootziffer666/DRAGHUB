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

function repoKeyOf(w: DesktopWindowState): string | null {
  return w.resource.type === "repository" ||
    w.resource.type === "file" ||
    w.resource.type === "github-feature"
    ? w.resource.repoKey
    : null;
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
      for (const w of windows) {
        if (w.resource.type === "file") {
          // Editor child window: exactly its own file's draft.
          if (isDirty(canonical(w.resource.repoKey), w.resource.path)) {
            blockers.push({
              type: "unsaved-draft",
              windowId: w.id,
              label: `Unsaved draft: ${w.resource.path}`,
            });
          }
          continue;
        }
        if (w.resource.type !== "repository") continue;
        const repoKey = canonical(w.resource.repoKey);
        if (seenRepos.has(repoKey)) continue;
        seenRepos.add(repoKey);
        // Dirty editor drafts anywhere in this repository (tab editors),
        // excluding files already covered by a child editor window above.
        const childFilePaths = new Set(
          windows
            .filter((x) => x.resource.type === "file")
            .map((x) => (x.resource.type === "file" ? x.resource.path : ""))
        );
        for (const s of dirtySessionsFor(repoKey)) {
          if (childFilePaths.has(s.path)) continue;
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

      const windows = [context.target, ...context.children];
      const repoKeys = [
        ...new Set(
          windows
            .map(repoKeyOf)
            .filter((k): k is string => k !== null)
            .map(canonical)
        ),
      ];

      if (resolution.action === "commit-and-close") {
        if (!getGithubToken()) {
          return {
            success: false,
            error:
              "No GitHub token configured — save a PAT in Settings, or discard to the Recycle Bin instead.",
          };
        }
        for (const repoKey of repoKeys) {
          // Unsaved drafts become staged changes so the checkpoint includes them.
          for (const s of dirtySessionsFor(repoKey)) {
            await stageEditDirect(repoKey, s.path, s.draft);
            discardDraft(repoKey, s.path);
          }
          if (changesFor(repoKey).length === 0) continue;
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
        }
        return { success: true };
      }

      // discard-to-recycle-bin-and-close
      const entries: RecycleBinEntry[] = [];
      for (const repoKey of repoKeys) {
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
      }
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
