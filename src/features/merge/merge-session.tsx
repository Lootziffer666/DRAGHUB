"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useStore } from "@/lib/store";
import { useChanges } from "@/features/changes";
import { fetchBranches } from "@/lib/github";
import type { ConflictResolution } from "@/lib/merge";
import { planMerge, conflictCountFor, resolvedTextFor, type FileMergePlan, type MergePreview } from "./plan";

export type ResolutionState =
  | { kind: "hunks"; hunkResolutions: (ConflictResolution | null)[] }
  | { kind: "delete-modify"; choice: "keep" | "delete" | null };

type Phase =
  | { phase: "idle" }
  | { phase: "picking"; branches: string[] }
  | { phase: "loading"; done: number; total: number }
  | { phase: "review" }
  | { phase: "applying" }
  | { phase: "done"; staged: number }
  | { phase: "error"; error: string };

type MergeSessionValue = {
  phase: Phase;
  preview: MergePreview | null;
  resolutions: Record<string, ResolutionState>;
  open: () => Promise<void>;
  close: () => void;
  selectBranch: (branch: string) => Promise<void>;
  setHunkResolution: (path: string, hunkIndex: number, resolution: ConflictResolution) => void;
  setDeleteChoice: (path: string, choice: "keep" | "delete") => void;
  isFullyResolved: (plan: FileMergePlan) => boolean;
  apply: () => Promise<void>;
};

const MergeSessionContext = createContext<MergeSessionValue | null>(null);

function initialResolution(plan: FileMergePlan): ResolutionState {
  if (plan.status !== "conflict") return { kind: "hunks", hunkResolutions: [] };
  if (plan.kind === "delete-modify") return { kind: "delete-modify", choice: null };
  const count = conflictCountFor(plan);
  return { kind: "hunks", hunkResolutions: new Array(count).fill(null) };
}

export function MergeSessionProvider({ children }: { children: ReactNode }) {
  const { state } = useStore();
  const meta = state.meta;
  const { stageAddFile, stageEdit, stageDelete } = useChanges();

  const [phase, setPhase] = useState<Phase>({ phase: "idle" });
  const [preview, setPreview] = useState<MergePreview | null>(null);
  const [resolutions, setResolutions] = useState<Record<string, ResolutionState>>({});

  const open = useCallback(async () => {
    if (!meta) return;
    setPhase({ phase: "loading", done: 0, total: 1 });
    try {
      const branches = (await fetchBranches(meta.owner, meta.repo)).filter(
        (b) => b !== meta.branch
      );
      setPhase({ phase: "picking", branches });
    } catch (err) {
      setPhase({
        phase: "error",
        error: err instanceof Error ? err.message : "Failed to load branches.",
      });
    }
  }, [meta]);

  const close = useCallback(() => {
    setPhase({ phase: "idle" });
    setPreview(null);
    setResolutions({});
  }, []);

  const selectBranch = useCallback(
    async (branch: string) => {
      if (!meta) return;
      setPhase({ phase: "loading", done: 0, total: 1 });
      try {
        const result = await planMerge(meta.owner, meta.repo, meta.branch, branch, (done, total) =>
          setPhase({ phase: "loading", done, total: Math.max(total, 1) })
        );
        setPreview(result);
        const initial: Record<string, ResolutionState> = {};
        for (const plan of result.plans) initial[plan.path] = initialResolution(plan);
        setResolutions(initial);
        setPhase({ phase: "review" });
      } catch (err) {
        setPhase({
          phase: "error",
          error: err instanceof Error ? err.message : "Failed to plan merge.",
        });
      }
    },
    [meta]
  );

  const setHunkResolution = useCallback(
    (path: string, hunkIndex: number, resolution: ConflictResolution) => {
      setResolutions((prev) => {
        const current = prev[path];
        if (!current || current.kind !== "hunks") return prev;
        const hunkResolutions = [...current.hunkResolutions];
        hunkResolutions[hunkIndex] = resolution;
        return { ...prev, [path]: { kind: "hunks", hunkResolutions } };
      });
    },
    []
  );

  const setDeleteChoice = useCallback((path: string, choice: "keep" | "delete") => {
    setResolutions((prev) => ({ ...prev, [path]: { kind: "delete-modify", choice } }));
  }, []);

  const isFullyResolved = useCallback(
    (plan: FileMergePlan): boolean => {
      if (plan.status !== "conflict") return true;
      const res = resolutions[plan.path];
      if (!res) return false;
      if (res.kind === "delete-modify") return res.choice !== null;
      return res.hunkResolutions.every((r) => r !== null);
    },
    [resolutions]
  );

  const apply = useCallback(async () => {
    if (!preview) return;
    setPhase({ phase: "applying" });
    let staged = 0;
    for (const plan of preview.plans) {
      if (plan.status === "clean") {
        if (plan.action === "none") continue;
        if (plan.action === "add") {
          await stageAddFile(plan.path, new TextEncoder().encode(plan.content), "merge");
        } else if (plan.action === "modify") {
          await stageEdit(plan.path, new TextEncoder().encode(plan.content), "merge");
        } else if (plan.action === "delete") {
          stageDelete(plan.path, "file", "merge");
        }
        staged++;
        continue;
      }
      const res = resolutions[plan.path];
      if (plan.kind === "delete-modify") {
        const choice = res?.kind === "delete-modify" ? res.choice : null;
        if (choice === "delete") stageDelete(plan.path, "file", "merge");
        else if (choice === "keep") {
          await stageEdit(plan.path, new TextEncoder().encode(plan.survivingText), "merge");
        } else continue;
        staged++;
        continue;
      }
      const hunkResolutions =
        res?.kind === "hunks" ? res.hunkResolutions.filter((r): r is ConflictResolution => r !== null) : [];
      if (hunkResolutions.length !== conflictCountFor(plan)) continue;
      const text = resolvedTextFor(plan, hunkResolutions);
      await stageEdit(plan.path, new TextEncoder().encode(text), "merge");
      staged++;
    }
    setPhase({ phase: "done", staged });
  }, [preview, resolutions, stageAddFile, stageEdit, stageDelete]);

  const value = useMemo<MergeSessionValue>(
    () => ({
      phase,
      preview,
      resolutions,
      open,
      close,
      selectBranch,
      setHunkResolution,
      setDeleteChoice,
      isFullyResolved,
      apply,
    }),
    [phase, preview, resolutions, open, close, selectBranch, setHunkResolution, setDeleteChoice, isFullyResolved, apply]
  );

  return <MergeSessionContext.Provider value={value}>{children}</MergeSessionContext.Provider>;
}

export function useMergeSession(): MergeSessionValue {
  const ctx = useContext(MergeSessionContext);
  if (!ctx) throw new Error("useMergeSession must be used within MergeSessionProvider");
  return ctx;
}
