"use client";

import { useState } from "react";
import { Home } from "@/components/icons";
import { StartMenuPanel } from "./StartMenuPanel";

export function StartMenuButton({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Start Menu — Codespaces, Releases & Packages, Wiki"
        className={[
          "flex items-center gap-1.5 rounded-md border border-neutral-700 bg-neutral-950 px-2.5 py-1.5 text-sm text-neutral-300 hover:border-neutral-600",
          className,
        ].join(" ")}
      >
        <Home width={14} height={14} className="text-neutral-500" />
        <span className="hidden sm:inline">Start</span>
      </button>
      {open && <StartMenuPanel onClose={() => setOpen(false)} />}
    </>
  );
}
