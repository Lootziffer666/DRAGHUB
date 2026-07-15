import type { GithubEntry } from "@/lib/github";
import {
  baseNameOfPath,
  parentOfPath,
  type WorkingChange,
} from "@/lib/github-ops";

export type OverlayStatus =
  | "unchanged"
  | "added"
  | "modified"
  | "renamed-in"
  | "pending-delete";

export type OverlayEntry = GithubEntry & {
  status: OverlayStatus;
  changeId?: string;
};

/**
 * Merge a directory's base entries (from the store's tree cache) with the
 * pending changeset so the Explorer/FolderView can render "current state +
 * unsaved deltas" (PLAN.md §4) without waiting for a checkpoint commit.
 */
export function overlayDirEntries(
  dirPath: string,
  baseEntries: GithubEntry[],
  changes: WorkingChange[]
): OverlayEntry[] {
  const hiddenSources = new Set<string>();
  for (const c of changes) {
    if (c.kind === "rename" && c.fromPath && parentOfPath(c.fromPath) === dirPath) {
      hiddenSources.add(c.fromPath);
    }
  }

  const result: OverlayEntry[] = [];
  for (const e of baseEntries) {
    const del = changes.find((c) => c.kind === "delete" && c.path === e.path);
    if (del) {
      result.push({ ...e, status: "pending-delete", changeId: del.id });
      continue;
    }
    const mod = changes.find((c) => c.kind === "modify" && c.path === e.path);
    if (mod) {
      result.push({ ...e, size: mod.size ?? e.size, status: "modified", changeId: mod.id });
      continue;
    }
    if (hiddenSources.has(e.path)) continue; // moved away by a pending rename
    result.push({ ...e, status: "unchanged" });
  }

  for (const c of changes) {
    if (c.kind === "add" && parentOfPath(c.path) === dirPath) {
      result.push({
        name: baseNameOfPath(c.path),
        path: c.path,
        type: c.entryKind,
        size: c.size ?? 0,
        sha: `pending:${c.id}`,
        url: "",
        status: "added",
        changeId: c.id,
      });
    }
    if (c.kind === "rename" && parentOfPath(c.path) === dirPath) {
      result.push({
        name: baseNameOfPath(c.path),
        path: c.path,
        type: c.entryKind,
        size: c.size ?? 0,
        sha: `pending:${c.id}`,
        url: "",
        status: "renamed-in",
        changeId: c.id,
      });
    }
  }

  return result.sort((a, b) => {
    if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

/** The path to read content/children from — a renamed-in entry's bytes still
 * live at its original (not-yet-moved) path on GitHub until checkpoint. */
export function readPathFor(entry: OverlayEntry, changes: WorkingChange[]): string {
  if (entry.status !== "renamed-in") return entry.path;
  const change = changes.find((c) => c.id === entry.changeId);
  return change?.fromPath ?? entry.path;
}

export function pendingChangeFor(
  path: string,
  changes: WorkingChange[]
): WorkingChange | undefined {
  return changes.find((c) => c.path === path);
}
