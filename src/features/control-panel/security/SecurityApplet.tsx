"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { Spinner } from "@/components/icons";
import {
  fetchCodeScanningAlerts,
  fetchDependabotAlerts,
  fetchSecretScanningAlerts,
  type AlertResult,
} from "./api";

const SEVERITY_STYLE: Record<string, string> = {
  critical: "bg-red-500/20 text-red-400",
  high: "bg-orange-500/20 text-orange-400",
  medium: "bg-amber-500/20 text-amber-400",
  moderate: "bg-amber-500/20 text-amber-400",
  low: "bg-neutral-700/50 text-neutral-300",
};

function severityClass(sev: string): string {
  return SEVERITY_STYLE[sev.toLowerCase()] ?? "bg-neutral-700/50 text-neutral-300";
}

function AlertSection<T>({
  title,
  load,
  renderItem,
}: {
  title: string;
  load: () => Promise<AlertResult<T>>;
  renderItem: (item: T) => { key: string | number; label: string; severity?: string; htmlUrl: string };
}) {
  const [result, setResult] = useState<AlertResult<T> | null>(null);

  useEffect(() => {
    let cancelled = false;
    setResult(null);
    void load().then((r) => {
      if (!cancelled) setResult(r);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="rounded-lg border border-neutral-800 p-3">
      <h3 className="mb-2 text-sm font-semibold text-neutral-200">{title}</h3>
      {result === null && (
        <div className="flex items-center gap-2 text-sm text-neutral-500">
          <Spinner width={14} height={14} className="text-blue-400" /> Checking…
        </div>
      )}
      {result?.status === "forbidden" && (
        <p className="text-sm text-amber-400">Disabled — {result.message}</p>
      )}
      {result?.status === "unavailable" && <p className="text-sm text-neutral-500">{result.message}</p>}
      {result?.status === "error" && <p className="text-sm text-red-400">{result.message}</p>}
      {result?.status === "ok" && result.items.length === 0 && (
        <p className="text-sm text-emerald-400">No open alerts.</p>
      )}
      {result?.status === "ok" && result.items.length > 0 && (
        <ul className="space-y-1">
          {result.items.slice(0, 20).map((item) => {
            const r = renderItem(item);
            return (
              <li key={r.key} className="flex items-center gap-2 text-sm">
                {r.severity && (
                  <span className={["rounded px-1.5 py-0.5 text-[11px] font-medium", severityClass(r.severity)].join(" ")}>
                    {r.severity}
                  </span>
                )}
                <a href={r.htmlUrl} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-neutral-300 hover:text-blue-400 hover:underline">
                  {r.label}
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function SecurityApplet() {
  const { state } = useStore();
  const meta = state.meta;
  if (!meta) return null;

  return (
    <div className="space-y-3">
      <AlertSection
        title="Dependabot alerts"
        load={() => fetchDependabotAlerts(meta.owner, meta.repo)}
        renderItem={(a) => ({
          key: a.number,
          label: `${a.packageName} — ${a.summary}`,
          severity: a.severity,
          htmlUrl: a.htmlUrl,
        })}
      />
      <AlertSection
        title="Code scanning (CodeQL) alerts"
        load={() => fetchCodeScanningAlerts(meta.owner, meta.repo)}
        renderItem={(a) => ({ key: a.number, label: a.rule, severity: a.severity, htmlUrl: a.htmlUrl })}
      />
      <AlertSection
        title="Secret scanning alerts"
        load={() => fetchSecretScanningAlerts(meta.owner, meta.repo)}
        renderItem={(a) => ({ key: a.number, label: a.secretType, htmlUrl: a.htmlUrl })}
      />
    </div>
  );
}
