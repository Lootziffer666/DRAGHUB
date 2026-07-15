"use client";

import { useState } from "react";
import { GitCommit } from "@/components/icons";
import { ChangesProvider as InnerProvider, useChanges } from "./changes";
import { ChangesPanel } from "./ChangesPanel";
import type { ReactNode } from "react";

export { useChanges };
export type { WorkingChange, ChangeKind, EntryKind, ChangeOrigin } from "@/lib/github-ops";

export function ChangesProvider({ children }: { children: ReactNode }) {
  return <InnerProvider>{children}</InnerProvider>;
}

export function ChangesButton({ className = "" }: { className?: string }) {
  const { changes } = useChanges();
  const [open, setOpen] = useState(false);
  const count = changes.length;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Working changes"
        className={[
          "relative flex items-center gap-1.5 rounded-md border border-neutral-700 bg-neutral-950 px-2.5 py-1.5 text-sm text-neutral-300 hover:border-neutral-600",
          className,
        ].join(" ")}
      >
        <GitCommit width={14} height={14} className={count > 0 ? "text-amber-400" : "text-neutral-500"} />
        <span className="hidden sm:inline">Changes</span>
        {count > 0 && (
          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-semibold text-black">
            {count}
          </span>
        )}
      </button>
      {open && <ChangesPanel onClose={() => setOpen(false)} />}
    </>
  );
}
