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
import { useActiveRepo, useStore } from "@/lib/store";
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
};

const ChangesContext = createContext<ChangesContextValue | null>(null);

const META_KEY = "gh-browser-changes-meta";

export function ChangesProvider({ children }: { children: ReactNode }) {
  const { state, ensureDir, seedDir, invalidateDir } = useStore();
  const repo = useActiveRepo();
  const meta = repo?.meta ?? null;

  const [changes, setChanges] = useState<WorkingChange[]>([]);
  const [status, setStatus] = useState<ChangesStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("Checkpoint via GitHub Browser");

  const changesRef = useRef(changes);
  changesRef.current = changes;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(META_KEY);
      if (raw) setChanges(JSON.parse(raw) as WorkingChange[]);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(META_KEY, JSON.stringify(changes));
    } catch {
      /* ignore */
    }
  }, [changes]);

  // Changes are per-repository; a freshly opened repo starts with a clean slate.
  useEffect(() => {
    setChanges([]);
    setStatus("idle");
    setError(null);
  }, [meta?.fullName]);

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
    []
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
    [seedDir]
  );

  const stageDelete = useCallback(
    (path: string, entryKind: EntryKind, origin: ChangeOrigin = "manual") => {
      setChanges((prev) => {
        const addIdx = prev.findIndex((c) => c.kind === "add" && c.path === path);
        if (addIdx !== -1) {
          void (async () => {
            const blobId = prev[addIdx].blobId;
            if (blobId) await dbDelete(blobId);
          })();
          return prev.filter((_, i) => i !== addIdx);
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
    []
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
    []
  );

  const discardChange = useCallback((id: string) => {
    setChanges((prev) => {
      const change = prev.find((c) => c.id === id);
      if (change?.blobId) void dbDelete(change.blobId);
      if (change) events.emit("change.discarded", { path: change.path });
      return prev.filter((c) => c.id !== id);
    });
  }, []);

  const discardAll = useCallback(() => {
    for (const c of changesRef.current) {
      if (c.blobId) void dbDelete(c.blobId);
    }
    setChanges([]);
    setError(null);
    setStatus("idle");
  }, []);

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
      setChanges([]);
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
      for (const path of Object.keys(repo?.expanded ?? {})) {
        if (!repo?.expanded[path] || path === "") continue;
        invalidateDir(path);
        void ensureDir(path);
      }
    } else {
      setStatus("error");
      setError(result.error);
      events.emit("checkpoint.failed", { error: result.error });
    }
  }, [meta, message, ensureDir, invalidateDir, repo?.expanded]);

  const changeForPath = useCallback(
    (path: string) => changes.find((c) => c.path === path),
    [changes]
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
      stageDelete,
      stageRename,
      discardChange,
      discardAll,
      createCheckpoint,
      changeForPath,
    }),
    [
      changes,
      status,
      error,
      message,
      stageAddFile,
      stageAddFolder,
      stageDelete,
      stageRename,
      discardChange,
      discardAll,
      createCheckpoint,
      changeForPath,
    ]
  );

  return <ChangesContext.Provider value={value}>{children}</ChangesContext.Provider>;
}

export function useChanges(): ChangesContextValue {
  const ctx = useContext(ChangesContext);
  if (!ctx) throw new Error("useChanges must be used within ChangesProvider");
  return ctx;
}
