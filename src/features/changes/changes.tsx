"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useStore } from "@/lib/store";
import { dbPut, dbGet, dbDelete } from "@/lib/staging-db";
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
  createCheckpoint: () => Promise<void>;
  changeForPath: (path: string) => WorkingChange | undefined;
  loadPendingContent: (path: string) => Promise<Uint8Array | null>;
};

const ChangesContext = createContext<ChangesContextValue | null>(null);

// Since M8, pending changes are bucketed per repository so that switching
// the active repo (Dock quick-switch) never discards staged work. The old
// single-list storage key ("gh-browser-changes-meta") is intentionally
// abandoned rather than migrated — it couldn't say which repo it belonged to.
const META_KEY = "gh-browser-changes-by-repo";

export function ChangesProvider({ children }: { children: ReactNode }) {
  const { state, ensureDir, seedDir, invalidateDir } = useStore();
  const meta = state.meta;
  const repoKey = meta?.fullName ?? null;

  const [byRepo, setByRepo] = useState<Record<string, WorkingChange[]>>({});
  const [status, setStatus] = useState<ChangesStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("Checkpoint via GitHub Browser");

  const changes = useMemo(
    () => (repoKey ? (byRepo[repoKey] ?? []) : []),
    [byRepo, repoKey]
  );

  const changesRef = useRef(changes);
  changesRef.current = changes;
  const repoKeyRef = useRef(repoKey);
  repoKeyRef.current = repoKey;

  /** Applies `fn` to the active repo's pending-change list. */
  const setChanges = useCallback(
    (fn: (prev: WorkingChange[]) => WorkingChange[]) => {
      const key = repoKeyRef.current;
      if (!key) return;
      setByRepo((prev) => ({ ...prev, [key]: fn(prev[key] ?? []) }));
    },
    []
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem(META_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          setByRepo(parsed as Record<string, WorkingChange[]>);
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(META_KEY, JSON.stringify(byRepo));
    } catch {
      /* ignore */
    }
  }, [byRepo]);

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
    setChanges((prev) => {
      const change = prev.find((c) => c.id === id);
      if (change?.blobId) void dbDelete(change.blobId);
      if (change) events.emit("change.discarded", { path: change.path });
      return prev.filter((c) => c.id !== id);
    });
  }, [setChanges]);

  const discardAll = useCallback(() => {
    for (const c of changesRef.current) {
      if (c.blobId) void dbDelete(c.blobId);
    }
    setChanges(() => []);
    setError(null);
    setStatus("idle");
  }, [setChanges]);

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
      for (const path of Object.keys(state.expanded)) {
        if (!state.expanded[path] || path === "") continue;
        invalidateDir(path);
        void ensureDir(path);
      }
    } else {
      setStatus("error");
      setError(result.error);
      events.emit("checkpoint.failed", { error: result.error });
    }
  }, [meta, message, ensureDir, invalidateDir, state.expanded, setChanges]);

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
