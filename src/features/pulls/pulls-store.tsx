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
import {
  addLabels,
  closePull,
  deleteBranch,
  fetchCheckSummary,
  fetchPullDetail,
  fetchPulls,
  mergePull,
  requestReviewers,
  type CheckSummary,
  type MergeMethod,
  type PullDetail,
  type PullSummary,
} from "./api";
import { classifyPr, type PrClass } from "./classify";

type LoadState = "idle" | "loading" | "loaded" | "error";

type PullsContextValue = {
  items: PullSummary[];
  status: LoadState;
  error: string | null;
  details: Record<number, PullDetail>;
  checks: Record<number, CheckSummary>;
  detailStatus: Record<number, LoadState>;
  refresh: () => Promise<void>;
  loadDetail: (number: number) => Promise<void>;
  classify: (pr: PullSummary) => PrClass;
  merge: (number: number, method: MergeMethod) => Promise<{ ok: boolean; error?: string }>;
  close: (number: number, deleteHeadBranch: boolean) => Promise<{ ok: boolean; error?: string }>;
  requestReview: (number: number, reviewers: string[]) => Promise<{ ok: boolean; error?: string }>;
  label: (number: number, labels: string[]) => Promise<{ ok: boolean; error?: string }>;
};

const PullsContext = createContext<PullsContextValue | null>(null);

export function PullsProvider({ children }: { children: ReactNode }) {
  const { state } = useStore();
  const meta = state.meta;

  const [items, setItems] = useState<PullSummary[]>([]);
  const [status, setStatus] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<number, PullDetail>>({});
  const [checks, setChecks] = useState<Record<number, CheckSummary>>({});
  const [detailStatus, setDetailStatus] = useState<Record<number, LoadState>>({});

  const refresh = useCallback(async () => {
    if (!meta) return;
    setStatus("loading");
    setError(null);
    try {
      const data = await fetchPulls(meta.owner, meta.repo);
      setItems(data);
      setStatus("loaded");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Failed to load pull requests.");
    }
  }, [meta]);

  const loadDetail = useCallback(
    async (number: number) => {
      if (!meta || detailStatus[number] === "loading" || detailStatus[number] === "loaded") return;
      setDetailStatus((prev) => ({ ...prev, [number]: "loading" }));
      try {
        const pr = items.find((p) => p.number === number);
        const [detail, checkSummary] = await Promise.all([
          fetchPullDetail(meta.owner, meta.repo, number),
          pr ? fetchCheckSummary(meta.owner, meta.repo, pr.headSha) : Promise.resolve(undefined),
        ]);
        setDetails((prev) => ({ ...prev, [number]: detail }));
        if (checkSummary) setChecks((prev) => ({ ...prev, [number]: checkSummary }));
        setDetailStatus((prev) => ({ ...prev, [number]: "loaded" }));
      } catch {
        setDetailStatus((prev) => ({ ...prev, [number]: "error" }));
      }
    },
    [meta, items, detailStatus]
  );

  const classify = useCallback(
    (pr: PullSummary) => classifyPr(pr, details[pr.number], checks[pr.number]),
    [details, checks]
  );

  const merge = useCallback(
    async (number: number, method: MergeMethod) => {
      if (!meta) return { ok: false, error: "No repository open." };
      const result = await mergePull(meta.owner, meta.repo, number, method);
      if (result.ok) setItems((prev) => prev.filter((p) => p.number !== number));
      return result;
    },
    [meta]
  );

  const close = useCallback(
    async (number: number, deleteHeadBranch: boolean) => {
      if (!meta) return { ok: false, error: "No repository open." };
      const pr = items.find((p) => p.number === number);
      const result = await closePull(meta.owner, meta.repo, number);
      if (result.ok) {
        setItems((prev) => prev.filter((p) => p.number !== number));
        if (deleteHeadBranch && pr) {
          await deleteBranch(meta.owner, meta.repo, pr.headRef).catch(() => {});
        }
      }
      return result;
    },
    [meta, items]
  );

  const requestReview = useCallback(
    async (number: number, reviewers: string[]) => {
      if (!meta) return { ok: false, error: "No repository open." };
      const result = await requestReviewers(meta.owner, meta.repo, number, reviewers);
      if (result.ok) {
        setItems((prev) =>
          prev.map((p) =>
            p.number === number
              ? { ...p, requestedReviewers: [...p.requestedReviewers, ...reviewers] }
              : p
          )
        );
      }
      return result;
    },
    [meta]
  );

  const label = useCallback(
    async (number: number, labels: string[]) => {
      if (!meta) return { ok: false, error: "No repository open." };
      const result = await addLabels(meta.owner, meta.repo, number, labels);
      if (result.ok) {
        setItems((prev) =>
          prev.map((p) =>
            p.number === number ? { ...p, labels: [...new Set([...p.labels, ...labels])] } : p
          )
        );
      }
      return result;
    },
    [meta]
  );

  const value = useMemo<PullsContextValue>(
    () => ({
      items,
      status,
      error,
      details,
      checks,
      detailStatus,
      refresh,
      loadDetail,
      classify,
      merge,
      close,
      requestReview,
      label,
    }),
    [items, status, error, details, checks, detailStatus, refresh, loadDetail, classify, merge, close, requestReview, label]
  );

  return <PullsContext.Provider value={value}>{children}</PullsContext.Provider>;
}

export function usePulls(): PullsContextValue {
  const ctx = useContext(PullsContext);
  if (!ctx) throw new Error("usePulls must be used within PullsProvider");
  return ctx;
}
