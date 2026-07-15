"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { FileText } from "@/components/icons";
import { IssuesProvider as InnerProvider, useIssues } from "./issues-store";
import { IssuesPanel } from "./IssuesPanel";

export { useIssues };

export function IssuesProvider({ children }: { children: ReactNode }) {
  return <InnerProvider>{children}</InnerProvider>;
}

export function IssuesButton({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Issues"
        className={[
          "flex items-center gap-1.5 rounded-md border border-neutral-700 bg-neutral-950 px-2.5 py-1.5 text-sm text-neutral-300 hover:border-neutral-600",
          className,
        ].join(" ")}
      >
        <FileText width={14} height={14} className="text-neutral-500" />
        <span className="hidden sm:inline">Issues</span>
      </button>
      {open && <IssuesPanel onClose={() => setOpen(false)} />}
    </>
  );
}
