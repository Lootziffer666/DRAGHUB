"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { GitBranch } from "@/components/icons";
import { PullsProvider as InnerProvider, usePulls } from "./pulls-store";
import { PullsPanel } from "./PullsPanel";

export { usePulls };
export type { PrClass } from "./classify";

export function PullsProvider({ children }: { children: ReactNode }) {
  return <InnerProvider>{children}</InnerProvider>;
}

export function PullsButton({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Pull requests"
        className={[
          "flex items-center gap-1.5 rounded-md border border-neutral-700 bg-neutral-950 px-2.5 py-1.5 text-sm text-neutral-300 hover:border-neutral-600",
          className,
        ].join(" ")}
      >
        <GitBranch width={14} height={14} className="text-neutral-500" />
        <span className="hidden sm:inline">PRs</span>
      </button>
      {open && <PullsPanel onClose={() => setOpen(false)} />}
    </>
  );
}
