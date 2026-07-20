"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { Trash } from "@/components/icons";
import { useActiveRepo } from "@/lib/store";
import { useChanges } from "@/features/changes";
import { retainedCount, subscribeBin } from "@/lib/recycle-bin";
import { RecycleBinPanel } from "./RecycleBinPanel";

export function RecycleBinButton({ className = "" }: { className?: string }) {
  const repo = useActiveRepo();
  const changes = useChanges();
  const [open, setOpen] = useState(false);
  const repoKey = repo?.meta.fullName ?? null;

  const retained = useSyncExternalStore(
    subscribeBin,
    useCallback(() => (repoKey ? retainedCount(repoKey) : 0), [repoKey]),
    () => 0
  );
  const deletions = changes.changes.filter((c) => c.kind === "delete").length;
  const count = deletions + retained;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Recycle Bin"
        className={[
          "relative flex items-center gap-1.5 rounded-md border border-neutral-700 bg-neutral-950 px-2.5 py-1.5 text-sm text-neutral-300 hover:border-neutral-600",
          className,
        ].join(" ")}
      >
        <Trash width={14} height={14} className={count > 0 ? "text-sky-400" : "text-neutral-500"} />
        <span className="hidden sm:inline">Bin</span>
        {count > 0 && (
          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-sky-500 px-1 text-[10px] font-semibold text-black">
            {count}
          </span>
        )}
      </button>
      {open && <RecycleBinPanel onClose={() => setOpen(false)} />}
    </>
  );
}
