"use client";

import { useState } from "react";
import { GitCommit } from "@/components/icons";
import { ChangesProvider as InnerProvider, useChanges } from "./changes";
import { ChangesPanel } from "./ChangesPanel";
import type { ReactNode } from "react";

export { useChanges };
export {
  changesFor,
  pendingCount,
  repoKeysWithChanges,
  subscribeChanges,
  updateBucket,
} from "./store";
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
          "relative flex items-center gap-1.5 rounded-md border border-[var(--dh-window-border)] bg-[var(--dh-surface)] px-2.5 py-1.5 text-sm text-[var(--dh-text-secondary)] hover:border-[var(--dh-window-border-active)]",
          className,
        ].join(" ")}
      >
        <GitCommit width={14} height={14} className={count > 0 ? "text-amber-700 dark:text-amber-400" : "text-[var(--dh-text-secondary)]"} />
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
