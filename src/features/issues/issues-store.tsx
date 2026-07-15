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
import { addIssueLabels, closeIssue, fetchIssues, type IssueSummary } from "./api";

type LoadState = "idle" | "loading" | "loaded" | "error";

type IssuesContextValue = {
  items: IssueSummary[];
  status: LoadState;
  error: string | null;
  refresh: () => Promise<void>;
  close: (number: number) => Promise<{ ok: boolean; error?: string }>;
  label: (number: number, labels: string[]) => Promise<{ ok: boolean; error?: string }>;
};

const IssuesContext = createContext<IssuesContextValue | null>(null);

export function IssuesProvider({ children }: { children: ReactNode }) {
  const { state } = useStore();
  const meta = state.meta;

  const [items, setItems] = useState<IssueSummary[]>([]);
  const [status, setStatus] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!meta) return;
    setStatus("loading");
    setError(null);
    try {
      setItems(await fetchIssues(meta.owner, meta.repo));
      setStatus("loaded");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Failed to load issues.");
    }
  }, [meta]);

  const close = useCallback(
    async (number: number) => {
      if (!meta) return { ok: false, error: "No repository open." };
      const result = await closeIssue(meta.owner, meta.repo, number);
      if (result.ok) setItems((prev) => prev.filter((i) => i.number !== number));
      return result;
    },
    [meta]
  );

  const label = useCallback(
    async (number: number, labels: string[]) => {
      if (!meta) return { ok: false, error: "No repository open." };
      const result = await addIssueLabels(meta.owner, meta.repo, number, labels);
      if (result.ok) {
        setItems((prev) =>
          prev.map((i) =>
            i.number === number ? { ...i, labels: [...new Set([...i.labels, ...labels])] } : i
          )
        );
      }
      return result;
    },
    [meta]
  );

  const value = useMemo<IssuesContextValue>(
    () => ({ items, status, error, refresh, close, label }),
    [items, status, error, refresh, close, label]
  );

  return <IssuesContext.Provider value={value}>{children}</IssuesContext.Provider>;
}

export function useIssues(): IssuesContextValue {
  const ctx = useContext(IssuesContext);
  if (!ctx) throw new Error("useIssues must be used within IssuesProvider");
  return ctx;
}
