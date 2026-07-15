"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { Spinner } from "@/components/icons";
import { fetchBranchProtection, type BranchProtectionResult } from "./api";

export function BranchRulesApplet() {
  const { state } = useStore();
  const meta = state.meta;
  const [result, setResult] = useState<BranchProtectionResult | null>(null);

  useEffect(() => {
    if (!meta) return;
    let cancelled = false;
    setResult(null);
    void fetchBranchProtection(meta.owner, meta.repo, meta.branch).then((r) => {
      if (!cancelled) setResult(r);
    });
    return () => {
      cancelled = true;
    };
  }, [meta]);

  if (!meta) return null;

  return (
    <div className="rounded-lg border border-neutral-800 p-3">
      <h3 className="mb-2 text-sm font-semibold text-neutral-200">
        Branch protection — <span className="font-mono text-neutral-400">{meta.branch}</span>
      </h3>
      {result === null && (
        <div className="flex items-center gap-2 text-sm text-neutral-500">
          <Spinner width={14} height={14} className="text-blue-400" /> Checking…
        </div>
      )}
      {result?.status === "forbidden" && <p className="text-sm text-amber-400">Disabled — {result.message}</p>}
      {result?.status === "error" && <p className="text-sm text-red-400">{result.message}</p>}
      {result?.status === "unprotected" && (
        <p className="text-sm text-neutral-500">
          This branch has no protection rules. Read-only view — manage rules on GitHub.
        </p>
      )}
      {result?.status === "protected" && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <dt className="text-neutral-500">Required approving reviews</dt>
          <dd className="text-neutral-200">{result.data.requiredApprovingReviews ?? "none"}</dd>
          <dt className="text-neutral-500">Required status checks</dt>
          <dd className="text-neutral-200">
            {result.data.requiredStatusChecks.length > 0 ? result.data.requiredStatusChecks.join(", ") : "none"}
            {result.data.strictStatusChecks ? " (must be up to date)" : ""}
          </dd>
          <dt className="text-neutral-500">Enforced for admins</dt>
          <dd className="text-neutral-200">{result.data.enforceAdmins ? "yes" : "no"}</dd>
          <dt className="text-neutral-500">Force pushes allowed</dt>
          <dd className="text-neutral-200">{result.data.allowForcePushes ? "yes" : "no"}</dd>
          <dt className="text-neutral-500">Deletions allowed</dt>
          <dd className="text-neutral-200">{result.data.allowDeletions ? "yes" : "no"}</dd>
        </dl>
      )}
    </div>
  );
}
