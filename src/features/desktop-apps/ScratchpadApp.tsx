"use client";

import { useEffect, useState } from "react";
import type { WindowContentProps } from "@/features/desktop/types";

const KEY_PREFIX = "draghub-scratchpad:";

/** A real local scratchpad tool window — plain text persisted per tool id. */
export function ScratchpadApp({ resource }: WindowContentProps) {
  const toolId = resource.type === "tool" ? resource.toolId : "default";
  const storageKey = `${KEY_PREFIX}${toolId}`;
  const [text, setText] = useState("");

  useEffect(() => {
    try {
      setText(localStorage.getItem(storageKey) ?? "");
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  return (
    <div className="flex h-full flex-col bg-neutral-950">
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          try {
            localStorage.setItem(storageKey, e.target.value);
          } catch {
            /* ignore */
          }
        }}
        placeholder="Local notes — saved automatically in this browser."
        className="min-h-0 flex-1 resize-none bg-transparent p-3 font-mono text-sm text-neutral-200 outline-none placeholder:text-neutral-600"
        spellCheck={false}
      />
    </div>
  );
}
