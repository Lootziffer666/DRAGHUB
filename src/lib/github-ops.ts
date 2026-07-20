import { fetchTreeRecursive } from "./github";
import { commitChangeset, type TreeOpEntry } from "./github-write";

export type ChangeKind = "add" | "modify" | "delete" | "rename";
export type EntryKind = "file" | "dir";
export type ChangeOrigin = "manual" | "upload" | "edit" | "merge";

/**
 * A single pending mutation against the repository tree, not yet committed.
 * `path` is always the change's current/target location; `fromPath` is only
 * set for renames/moves and points at the still-unchanged source on GitHub.
 */
export type WorkingChange = {
  id: string;
  kind: ChangeKind;
  entryKind: EntryKind;
  path: string;
  fromPath?: string;
  origin: ChangeOrigin;
  size?: number;
  /** IndexedDB key holding the new content (add of a file only). */
  blobId?: string;
  createdAt: number;
};

export function newChangeId(): string {
  return crypto.randomUUID();
}

export function parentOfPath(path: string): string {
  const i = path.lastIndexOf("/");
  return i === -1 ? "" : path.slice(0, i);
}

export function baseNameOfPath(path: string): string {
  const i = path.lastIndexOf("/");
  return i === -1 ? path : path.slice(i + 1);
}

export function joinPath(dir: string, name: string): string {
  return dir ? `${dir}/${name}` : name;
}

/** Tree path used for a pending new, still-empty folder (git has no empty dirs). */
export function gitkeepPathFor(folderPath: string): string {
  return `${folderPath.replace(/\/+$/, "")}/.gitkeep`;
}

export type CommitChangesetOptions = {
  owner: string;
  repo: string;
  branch: string;
  message: string;
};

export type CommitChangesetResult =
  | { ok: true; commitSha: string }
  | { ok: false; error: string };

/**
 * Resolve a WorkingChange list into git tree operations and commit them as
 * one changeset ("Checkpoint"). Renames reuse the existing blob sha instead
 * of re-reading/re-uploading content — a rename never touches file bytes.
 */
export async function commitWorkingChanges(
  changes: WorkingChange[],
  opts: CommitChangesetOptions,
  loadBlob: (id: string) => Promise<Uint8Array | null>
): Promise<CommitChangesetResult> {
  if (changes.length === 0) {
    return { ok: false, error: "No changes to commit." };
  }

  try {
    const entries: TreeOpEntry[] = [];
    let fullTree: Awaited<ReturnType<typeof fetchTreeRecursive>> | null = null;
    const getFullTree = async () => {
      if (!fullTree) {
        fullTree = await fetchTreeRecursive(opts.owner, opts.repo, opts.branch);
      }
      return fullTree;
    };

    for (const change of changes) {
      if (change.kind === "add" || change.kind === "modify") {
        if (change.kind === "add" && change.entryKind === "dir") {
          entries.push({ path: gitkeepPathFor(change.path), op: "upsert", data: new Uint8Array(0) });
          continue;
        }
        if (!change.blobId) throw new Error(`Missing content for "${change.path}".`);
        const data = await loadBlob(change.blobId);
        if (!data) throw new Error(`Missing cached content for "${change.path}".`);
        entries.push({ path: change.path, op: "upsert", data });
      } else if (change.kind === "delete") {
        if (change.entryKind === "dir") {
          const tree = await getFullTree();
          const prefix = `${change.path.replace(/\/+$/, "")}/`;
          const under = tree.filter((e) => e.type === "blob" && e.path.startsWith(prefix));
          if (under.length === 0) {
            throw new Error(
              `Folder "${change.path}" is empty or was already removed on "${opts.branch}".`
            );
          }
          for (const e of under) entries.push({ path: e.path, op: "delete" });
        } else {
          entries.push({ path: change.path, op: "delete" });
        }
      } else if (change.kind === "rename") {
        if (!change.fromPath) throw new Error(`Rename of "${change.path}" is missing a source path.`);
        if (change.entryKind === "dir") {
          const tree = await getFullTree();
          const prefix = `${change.fromPath.replace(/\/+$/, "")}/`;
          const under = tree.filter((e) => e.type === "blob" && e.path.startsWith(prefix));
          if (under.length === 0) {
            throw new Error(`Folder "${change.fromPath}" is empty or was already removed.`);
          }
          const destPrefix = change.path.replace(/\/+$/, "");
          for (const e of under) {
            const rest = e.path.slice(prefix.length);
            entries.push({ path: `${destPrefix}/${rest}`, op: "reuse", sha: e.sha, mode: e.mode });
            entries.push({ path: e.path, op: "delete" });
          }
        } else {
          const tree = await getFullTree();
          const existing = tree.find((e) => e.type === "blob" && e.path === change.fromPath);
          if (!existing) throw new Error(`Source file "${change.fromPath}" was not found.`);
          entries.push({ path: change.path, op: "reuse", sha: existing.sha, mode: existing.mode });
          entries.push({ path: change.fromPath, op: "delete" });
        }
      }
    }

    const commitSha = await commitChangeset(entries, opts);
    return { ok: true, commitSha };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to create checkpoint.",
    };
  }
}
