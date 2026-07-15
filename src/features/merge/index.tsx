"use client";

import type { ReactNode } from "react";
import { GitBranch } from "@/components/icons";
import { MergeSessionProvider, useMergeSession } from "./merge-session";
import { MergePanel } from "./MergePanel";

export { useMergeSession };

export function MergeProvider({ children }: { children: ReactNode }) {
  return <MergeSessionProvider>{children}</MergeSessionProvider>;
}

export function MergeButton({ className = "" }: { className?: string }) {
  const session = useMergeSession();
  const open = session.phase.phase !== "idle";

  return (
    <>
      <button
        onClick={() => void session.open()}
        title="Merge another variant into this one"
        className={[
          "flex items-center gap-1.5 rounded-md border border-neutral-700 bg-neutral-950 px-2.5 py-1.5 text-sm text-neutral-300 hover:border-neutral-600",
          className,
        ].join(" ")}
      >
        <GitBranch width={14} height={14} className="text-neutral-500" />
        <span className="hidden sm:inline">Merge</span>
      </button>
      {open && <MergePanel onClose={session.close} />}
    </>
  );
}
