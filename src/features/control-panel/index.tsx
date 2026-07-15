"use client";

import { useState } from "react";
import { GitBranch } from "@/components/icons";
import { ControlPanel } from "./ControlPanel";

export function ControlPanelButton({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Control Panel — Security, Access, Branch Rules"
        className={[
          "flex items-center gap-1.5 rounded-md border border-neutral-700 bg-neutral-950 px-2.5 py-1.5 text-sm text-neutral-300 hover:border-neutral-600",
          className,
        ].join(" ")}
      >
        <GitBranch width={14} height={14} className="text-neutral-500" />
        <span className="hidden sm:inline">Control Panel</span>
      </button>
      {open && <ControlPanel onClose={() => setOpen(false)} />}
    </>
  );
}
