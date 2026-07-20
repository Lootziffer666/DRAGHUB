"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useActiveRepo, useStore } from "@/lib/store";
import { dbPut, dbGet, dbDelete } from "@/lib/staging-db";
import { retainDiscarded } from "@/lib/recycle-bin";
import { changesFor, subscribeChanges, updateBucket } from "./store";
import { events } from "@/lib/events";
import {
  commitWorkingChanges,
  newChangeId,
  type ChangeOrigin,
  type EntryKind,
  type WorkingChange,
} from "@/lib/github-ops";

export type ChangesStatus = "idle" | "committing" | "done" | "error";

type ChangesContextValue = {
  changes: WorkingChange[];
  status: ChangesStatus;
  error: string | null;
  message: string;
  setMessage: (m: string) => void;
  stageAddFile: (path: string, data: Uint8Array, origin?: ChangeOrigin) => Promise<void>;
  stageAddFolder: (path: string, origin?: ChangeOrigin) => void;
  stageEdit: (path: string, data: Uint8Array, origin?: ChangeOrigin) => Promise<void>;
  stageDelete: (path: string, entryKind: EntryKind, origin?: ChangeOrigin) => void;
  stageRename: (
    fromPath: string,
    toPath: string,
    entryKind: EntryKind,
    origin?: ChangeOrigin
  ) => void;
  discardChange: (id: string) => void;
  discardAll: () => void;
  /** Re-stages a change previously retained in the Recycle Bin. */
  restoreChange: (change: WorkingChange) => void;
  createCheckpoint: () => Promise<void>;
  changeForPath: (path: string) => WorkingChange | undefined;
  loadPendingContent: (path: string) => Promise<Uint8Array | null>;
};

const ChangesContext = createContext<ChangesContextValue | null>(null);

// Pending changes live in the module-level per-repo bucket store
// (`./store`). Each repository window mounts its own ChangesProvider bound to
// the window's scoped repository; all instances (and non-React consumers like
// the desktop lifecycle adapter) share the same buckets, so staging in a
// child window and its parent window stay consistent.
export function ChangesProvider({ children }: { children: ReactNode }) {
  const { ensureDir, seedDir, invalidateDir } = useStore();
  const activeRepo = useActiveRepo();
  const meta = activeRepo?.meta ?? null;
  const repoKey = meta?.fullName ?? null;

  const [status, setStatus] = useState<ChangesStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("Checkpoint via GitHub Browser");

  const changes = useSyncExternalStore(
    subscribeChanges,
    () => changesFor(repoKey),
    () => changesFor(null)
  );

  const changesRef = useRef(changes);
  changesRef.current = changes;
  const repoKeyRef = useRef(repoKey);
  repoKeyRef.current = repoKey;

  /** Applies `fn` to this provider's repository bucket. */
  const setChanges = useCallback(
    (fn: (prev: WorkingChange[]) => WorkingChange[]) => {
      const key = repoKeyRef.current;
      if (!key) return;
      updateBucket(key, fn);
    },
    []
  );

  // Status/error are transient UI state for the active repo's panel.
  useEffect(() => {
    setStatus("idle");
    setError(null);
  }, [repoKey]);

  const stageAddFile = useCallback(
    async (path: string, data: Uint8Array, origin: ChangeOrigin = "manual") => {
      const id = newChangeId();
      await dbPut(id, data);
      const change: WorkingChange = {
        id,
        kind: "add",
        entryKind: "file",
        path,
        origin,
        size: data.byteLength,
        blobId: id,
        createdAt: Date.now(),
      };
      setChanges((prev) => [...prev, change]);
      events.emit("change.staged", { kind: "add", path });
    },
    [setChanges]
  );

  const stageAddFolder = useCallback(
    (path: string, origin: ChangeOrigin = "manual") => {
      const change: WorkingChange = {
        id: newChangeId(),
        kind: "add",
        entryKind: "dir",
        path,
        origin,
        size: 0,
        createdAt: Date.now(),
      };
      setChanges((prev) => [...prev, change]);
      seedDir(path, []);
      events.emit("change.staged", { kind: "add", path });
    },
    [seedDir, setChanges]
  );

  const stageEdit = useCallback(
    async (path: string, data: Uint8Array, origin: ChangeOrigin = "edit") => {
      const existing = changesRef.current.find(
        (c) => (c.kind === "add" || c.kind === "modify") && c.path === path
      );
      const id = newChangeId();
      await dbPut(id, data);
      if (existing) {
        const oldBlobId = existing.blobId;
        setChanges((prev) =>
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
          origin,
          size: data.byteLength,
          blobId: id,
          createdAt: Date.now(),
        };
        setChanges((prev) => [...prev, change]);
      }
      events.emit("change.staged", { kind: "modify", path });
    },
    [setChanges]
  );

  const stageDelete = useCallback(
    (path: string, entryKind: EntryKind, origin: ChangeOrigin = "manual") => {
      setChanges((prev) => {
        const addIdx = prev.findIndex(
          (c) => (c.kind === "add" || c.kind === "modify") && c.path === path
        );
        if (addIdx !== -1) {
          const removed = prev[addIdx];
          void (async () => {
            if (removed.blobId) await dbDelete(removed.blobId);
          })();
          if (removed.kind === "add") {
            return prev.filter((_, i) => i !== addIdx);
          }
          // A pending edit of an existing remote file: cancel the edit and
          // stage a real delete instead (its blob is released above).
          const del: WorkingChange = {
            id: newChangeId(),
            kind: "delete",
            entryKind,
            path,
            origin,
            createdAt: Date.now(),
          };
          return [...prev.filter((_, i) => i !== addIdx), del];
        }
        const renameIdx = prev.findIndex((c) => c.kind === "rename" && c.path === path);
        if (renameIdx !== -1) {
          const rc = prev[renameIdx];
          const del: WorkingChange = {
            id: newChangeId(),
            kind: "delete",
            entryKind,
            path: rc.fromPath!,
            origin,
            createdAt: Date.now(),
          };
          return [...prev.filter((_, i) => i !== renameIdx), del];
        }
        return [
          ...prev,
          {
            id: newChangeId(),
            kind: "delete",
            entryKind,
            path,
            origin,
            createdAt: Date.now(),
          },
        ];
      });
      events.emit("change.staged", { kind: "delete", path });
    },
    [setChanges]
  );

  const stageRename = useCallback(
    (fromPath: string, toPath: string, entryKind: EntryKind, origin: ChangeOrigin = "manual") => {
      setChanges((prev) => {
        const addIdx = prev.findIndex((c) => c.kind === "add" && c.path === fromPath);
        if (addIdx !== -1) {
          const updated = [...prev];
          updated[addIdx] = { ...updated[addIdx], path: toPath };
          return updated;
        }
        const modifyIdx = prev.findIndex((c) => c.kind === "modify" && c.path === fromPath);
        if (modifyIdx !== -1) {
          // The edited content can't be moved via a blob-sha reuse (that would
          // discard the edit) — carry it to the new path as a plain upsert and
          // remove the untouched original.
          const mc = prev[modifyIdx];
          const addAtNew: WorkingChange = {
            id: newChangeId(),
            kind: "add",
            entryKind,
            path: toPath,
            origin,
            size: mc.size,
            blobId: mc.blobId,
            createdAt: Date.now(),
          };
          const delAtOld: WorkingChange = {
            id: newChangeId(),
            kind: "delete",
            entryKind,
            path: fromPath,
            origin,
            createdAt: Date.now(),
          };
          return [...prev.filter((_, i) => i !== modifyIdx), addAtNew, delAtOld];
        }
        const renameIdx = prev.findIndex((c) => c.kind === "rename" && c.path === fromPath);
        if (renameIdx !== -1) {
          const updated = [...prev];
          updated[renameIdx] = { ...updated[renameIdx], path: toPath };
          return updated;
        }
        return [
          ...prev,
          {
            id: newChangeId(),
            kind: "rename",
            entryKind,
            path: toPath,
            fromPath,
            origin,
            createdAt: Date.now(),
          },
        ];
      });
      events.emit("change.staged", { kind: "rename", path: toPath });
    },
    [setChanges]
  );

  const discardChange = useCallback((id: string) => {
    // Side effects stay outside the updater — React may invoke updaters twice.
    const change = changesRef.current.find((c) => c.id === id);
    if (!change) return;
    // Content-bearing changes go to the Recycle Bin (blob retained for a
    // grace period) instead of being destroyed immediately.
    if (change.blobId && repoKeyRef.current) {
      retainDiscarded(repoKeyRef.current, change);
    }
    events.emit("change.discarded", { path: change.path });
    setChanges((prev) => prev.filter((c) => c.id !== id));
  }, [setChanges]);

  const discardAll = useCallback(() => {
    for (const c of changesRef.current) {
      if (c.blobId && repoKeyRef.current) retainDiscarded(repoKeyRef.current, c);
    }
    setChanges(() => []);
    setError(null);
    setStatus("idle");
  }, [setChanges]);

  const restoreChange = useCallback(
    (change: WorkingChange) => {
      setChanges((prev) =>
        prev.some((c) => c.id === change.id) ? prev : [...prev, change]
      );
      events.emit("change.staged", { kind: change.kind, path: change.path });
    },
    [setChanges]
  );

  const createCheckpoint = useCallback(async () => {
    const current = changesRef.current;
    if (current.length === 0 || !meta) return;
    setStatus("committing");
    setError(null);

    const result = await commitWorkingChanges(
      current,
      { owner: meta.owner, repo: meta.repo, branch: meta.branch, message },
      dbGet
    );

    if (result.ok) {
      for (const c of current) {
        if (c.blobId) await dbDelete(c.blobId);
      }
      setChanges(() => []);
      setStatus("done");
      events.emit("checkpoint.created", {
        commitSha: result.commitSha,
        changes: current.length,
        branch: meta.branch,
      });
      // Re-fetch every directory the user currently has expanded so the
      // Explorer reflects the new commit instead of the stale overlay.
      invalidateDir("");
      void ensureDir("");
      const expanded = activeRepo?.expanded ?? {};
      for (const path of Object.keys(expanded)) {
        if (!expanded[path] || path === "") continue;
        invalidateDir(path);
        void ensureDir(path);
      }
    } else {
      setStatus("error");
      setError(result.error);
      events.emit("checkpoint.failed", { error: result.error });
    }
  }, [meta, message, ensureDir, invalidateDir, activeRepo?.expanded, setChanges]);

  const changeForPath = useCallback(
    (path: string) => changes.find((c) => c.path === path),
    [changes]
  );

  const loadPendingContent = useCallback(
    async (path: string) => {
      const change = changesRef.current.find(
        (c) => (c.kind === "add" || c.kind === "modify") && c.path === path
      );
      if (!change?.blobId) return null;
      return dbGet(change.blobId);
    },
    []
  );

  const value = useMemo<ChangesContextValue>(
    () => ({
      changes,
      status,
      error,
      message,
      setMessage,
      stageAddFile,
      stageAddFolder,
      stageEdit,
      stageDelete,
      stageRename,
      discardChange,
      discardAll,
      restoreChange,
      createCheckpoint,
      changeForPath,
      loadPendingContent,
    }),
    [
      changes,
      status,
      error,
      message,
      stageAddFile,
      stageAddFolder,
      stageEdit,
      stageDelete,
      stageRename,
      discardChange,
      discardAll,
      restoreChange,
      createCheckpoint,
      changeForPath,
      loadPendingContent,
    ]
  );

  return <ChangesContext.Provider value={value}>{children}</ChangesContext.Provider>;
}

export function useChanges(): ChangesContextValue {
  const ctx = useContext(ChangesContext);
  if (!ctx) throw new Error("useChanges must be used within ChangesProvider");
  return ctx;
}
