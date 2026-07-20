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
import { useActiveRepo, useStore } from "./store";
import { extractArchive, archiveKind, type ExtractedFile } from "./extract";
import {
  commitFiles,
  type CommitFile,
  type CommitProgress,
  type CommitResult,
} from "./github-write";
import { dbPut, dbGet, dbDelete, dbClear } from "./staging-db";

export type StagingItem = {
  id: string;
  path: string;
  size: number;
  source: "file" | "archive";
  archiveName?: string;
};

export type StagingStatus = "idle" | "processing" | "committing" | "done" | "error";

type StagingOptions = {
  branch: string;
  message: string;
  useLfs: boolean;
  lfsThresholdBytes: number;
};

type StagingContextValue = {
  items: StagingItem[];
  options: StagingOptions;
  status: StagingStatus;
  progress: CommitProgress | null;
  error: string | null;
  summary: CommitResult | null;
  totalBytes: number;
  addFiles: (files: File[], baseDir?: string) => Promise<void>;
  removeItem: (id: string) => void;
  clearAll: () => void;
  setOptions: (patch: Partial<StagingOptions>) => void;
  commit: () => Promise<void>;
};

const META_KEY = "gh-browser-staging-meta";

const StagingContext = createContext<StagingContextValue | null>(null);

export function StagingProvider({ children }: { children: ReactNode }) {
  const { state } = useStore();
  const repo = useActiveRepo();
  const meta = repo?.meta ?? null;

  const [items, setItems] = useState<StagingItem[]>([]);
  const [options, setOptionsState] = useState<StagingOptions>({
    branch: meta?.branch ?? "",
    message: "Add files via GitHub Browser",
    useLfs: false,
    lfsThresholdBytes: 50 * 1024 * 1024,
  });
  const [status, setStatus] = useState<StagingStatus>("idle");
  const [progress, setProgress] = useState<CommitProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<CommitResult | null>(null);

  const itemsRef = useRef(items);
  itemsRef.current = items;

  // Load cached metadata from a previous session.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(META_KEY);
      if (raw) setItems(JSON.parse(raw) as StagingItem[]);
    } catch {
      /* ignore */
    }
  }, []);

  // Persist metadata so the staging cache survives reloads.
  useEffect(() => {
    try {
      localStorage.setItem(META_KEY, JSON.stringify(items));
    } catch {
      /* ignore */
    }
  }, [items]);

  // Keep default branch in sync when a repo is opened.
  useEffect(() => {
    if (meta && !options.branch) {
      setOptionsState((o) => ({ ...o, branch: meta.branch }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta]);

  const stageExtracted = useCallback(
    async (ef: ExtractedFile, prefix: string, archiveName: string) => {
      const path = prefix + ef.path;
      const id = crypto.randomUUID();
      await dbPut(id, ef.data);
      setItems((prev) => [
        ...prev,
        {
          id,
          path,
          size: ef.data.byteLength,
          source: "archive",
          archiveName,
        },
      ]);
    },
    []
  );

  const addFiles = useCallback(
    async (files: File[], baseDir = "") => {
      if (files.length === 0) return;
      setStatus("processing");
      setError(null);
      const base = baseDir.replace(/^\/+/, "").replace(/\/+$/, "");
      const prefix = base ? `${base}/` : "";

      try {
        for (const file of files) {
          const isArc = archiveKind(file.name);
          if (isArc) {
            const extracted = await extractArchive(file);
            for (const ef of extracted) {
              await stageExtracted(ef, prefix, file.name);
            }
          } else {
            const data = new Uint8Array(await file.arrayBuffer());
            const path = prefix + file.name;
            const id = crypto.randomUUID();
            await dbPut(id, data);
            setItems((prev) => [
              ...prev,
              { id, path, size: data.byteLength, source: "file" },
            ]);
          }
        }
        setStatus("idle");
      } catch (err) {
        setStatus("error");
        setError(
          err instanceof Error ? err.message : "Failed to process files."
        );
      }
    },
    [stageExtracted]
  );

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    void dbDelete(id);
  }, []);

  const clearAll = useCallback(() => {
    setItems([]);
    setSummary(null);
    setError(null);
    setProgress(null);
    setStatus("idle");
    void dbClear();
  }, []);

  const setOptions = useCallback((patch: Partial<StagingOptions>) => {
    setOptionsState((o) => ({ ...o, ...patch }));
  }, []);

  const commit = useCallback(async () => {
    const current = itemsRef.current;
    if (current.length === 0 || !meta) return;
    setStatus("committing");
    setError(null);
    setSummary(null);

    try {
      const files: CommitFile[] = [];
      for (const item of current) {
        const data = await dbGet(item.id);
        if (!data) {
          setStatus("error");
          setError(`Missing cached data for ${item.path}.`);
          return;
        }
        files.push({ path: item.path, data });
      }

      const result = await commitFiles(files, {
        owner: meta.owner,
        repo: meta.repo,
        branch: options.branch || meta.branch,
        message: options.message,
        useLfs: options.useLfs,
        lfsThresholdBytes: options.lfsThresholdBytes,
        onProgress: setProgress,
      });

      if (result.ok) {
        // Commit succeeded: clear the cache now.
        setItems([]);
        void dbClear();
        setStatus("done");
        setSummary(result);
      } else {
        // Keep the cache so the user can retry.
        setStatus("error");
        setError(result.errors.join(" "));
        setSummary(result);
      }
    } catch (err) {
      setStatus("error");
      setError(
        err instanceof Error ? err.message : "Commit failed."
      );
    }
  }, [meta, options.branch, options.message, options.useLfs, options.lfsThresholdBytes]);

  const totalBytes = useMemo(
    () => items.reduce((sum, i) => sum + i.size, 0),
    [items]
  );

  const value = useMemo<StagingContextValue>(
    () => ({
      items,
      options,
      status,
      progress,
      error,
      summary,
      totalBytes,
      addFiles,
      removeItem,
      clearAll,
      setOptions,
      commit,
    }),
    [
      items,
      options,
      status,
      progress,
      error,
      summary,
      totalBytes,
      addFiles,
      removeItem,
      clearAll,
      setOptions,
      commit,
    ]
  );

  return (
    <StagingContext.Provider value={value}>{children}</StagingContext.Provider>
  );
}

export function useStaging(): StagingContextValue {
  const ctx = useContext(StagingContext);
  if (!ctx) throw new Error("useStaging must be used within StagingProvider");
  return ctx;
}
