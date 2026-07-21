import { dbPut, dbGet, dbDelete } from "@/lib/staging-db";
import {
  commitWorkingChanges,
  newChangeId,
  type WorkingChange,
} from "@/lib/github-ops";
import { retainDiscarded } from "@/lib/recycle-bin";
import { events } from "@/lib/events";
import { changesFor, updateBucket } from "./store";

/**
 * Provider-free working-change operations for callers outside a repository
 * window's React tree — primarily the desktop window-close lifecycle adapter
 * (POST_PR8_REFERENCE_INTEGRATION Stage 4). Every function takes an explicit
 * repoKey; nothing here consults a global active repository.
 */

/** Stages editor content as a pending change (mirror of ChangesProvider.stageEdit). */
export async function stageEditDirect(
  repoKey: string,
  path: string,
  content: string
): Promise<void> {
  const data = new TextEncoder().encode(content);
  const existing = changesFor(repoKey).find(
    (c) => (c.kind === "add" || c.kind === "modify") && c.path === path
  );
  const id = newChangeId();
  await dbPut(id, data);
  if (existing) {
    const oldBlobId = existing.blobId;
    updateBucket(repoKey, (prev) =>
      prev.map((c) =>
        c.id === existing.id ? { ...c, blobId: id, size: data.byteLength } : c
      )
    );
    if (oldBlobId) await dbDelete(oldBlobId);
  } else {
    const change: WorkingChange = {
      id,
      kind: "modify",
      entryKind: "file",
      path,
      origin: "edit",
      size: data.byteLength,
      blobId: id,
      createdAt: Date.now(),
    };
    updateBucket(repoKey, (prev) => [...prev, change]);
  }
  events.emit("change.staged", { kind: "modify", path });
}

/** Commits a repository's whole pending bucket as one checkpoint. */
export async function checkpointRepo(
  repoKey: string,
  meta: { owner: string; repo: string; branch: string },
  message: string
): Promise<{ ok: true; commitSha: string } | { ok: false; error: string }> {
  const current = changesFor(repoKey);
  if (current.length === 0) return { ok: false, error: "Nothing to commit." };
  const result = await commitWorkingChanges(
    current,
    { owner: meta.owner, repo: meta.repo, branch: meta.branch, message },
    dbGet
  );
  if (!result.ok) {
    events.emit("checkpoint.failed", { error: result.error });
    return { ok: false, error: result.error };
  }
  for (const c of current) {
    if (c.blobId) await dbDelete(c.blobId);
  }
  updateBucket(repoKey, () => []);
  events.emit("checkpoint.created", {
    commitSha: result.commitSha,
    changes: current.length,
    branch: meta.branch,
  });
  return { ok: true, commitSha: result.commitSha };
}

/** Moves a repository's pending bucket into the domain Recycle Bin
 * (content-bearing changes keep their blobs for the grace period). */
export function discardBucketToBin(repoKey: string): number {
  const current = changesFor(repoKey);
  for (const c of current) {
    if (c.blobId) retainDiscarded(repoKey, c);
  }
  if (current.length > 0) updateBucket(repoKey, () => []);
  return current.length;
}
