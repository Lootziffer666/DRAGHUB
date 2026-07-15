"use client";

import { useState } from "react";
import { X, GitBranch } from "@/components/icons";
import { SecurityApplet } from "./security/SecurityApplet";
import { AccessApplet } from "./access/AccessApplet";
import { BranchRulesApplet } from "./branch-rules/BranchRulesApplet";

type Tab = "security" | "access" | "branch-rules";

export function ControlPanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("security");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-neutral-700 bg-neutral-900 shadow-2xl">
        <div className="flex items-center gap-2 border-b border-neutral-800 px-4 py-3">
          <GitBranch width={18} height={18} className="text-blue-400" />
          <h2 className="text-sm font-semibold text-neutral-100">Control Panel</h2>
          <button
            onClick={onClose}
            className="ml-auto flex h-8 w-8 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
          >
            <X width={16} height={16} />
          </button>
        </div>

        <div className="flex gap-1 border-b border-neutral-800 px-4 pt-2">
          {(
            [
              ["security", "Security"],
              ["access", "Access"],
              ["branch-rules", "Branch Rules"],
            ] as [Tab, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={[
                "rounded-t-md px-3 py-1.5 text-sm",
                tab === id
                  ? "bg-neutral-800 text-neutral-100"
                  : "text-neutral-500 hover:text-neutral-300",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {tab === "security" && <SecurityApplet />}
          {tab === "access" && <AccessApplet />}
          {tab === "branch-rules" && <BranchRulesApplet />}
        </div>
      </div>
    </div>
  );
}
