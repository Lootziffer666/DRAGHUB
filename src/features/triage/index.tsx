"use client";

import { useState } from "react";
import { GitCommit } from "@/components/icons";
import { TriagePanel } from "./TriagePanel";

export function TriageButton({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Triage pull requests"
        className={[
          "flex items-center gap-1.5 rounded-md border border-neutral-700 bg-neutral-950 px-2.5 py-1.5 text-sm text-neutral-300 hover:border-neutral-600",
          className,
        ].join(" ")}
      >
        <GitCommit width={14} height={14} className="text-neutral-500" />
        <span className="hidden sm:inline">Triage</span>
      </button>
      {open && <TriagePanel onClose={() => setOpen(false)} />}
    </>
  );
}
