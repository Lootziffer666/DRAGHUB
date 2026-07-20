"use client";
import { useState } from "react";
import type { WindowContentProps } from "../types";
export function MockToolWindow({ resource }: WindowContentProps) {
  const [dirty, setDirty] = useState(true);
  return (
    <div className="mock-panel">
      <span className="demo-pill">LOCAL TOOL DEMO</span>
      <h2>Scratchpad</h2>
      <p>This window demonstrates an adapter-ready global tool.</p>
      <textarea
        defaultValue="Desktop tools, agents and jobs will connect here through adapters."
        onChange={() => setDirty(true)}
      />
      <button onClick={() => setDirty(false)}>Save simulated draft</button>
      {dirty && (
        <strong className="unsaved">
          ● Unsaved demo draft — closing asks for confirmation
        </strong>
      )}
      <small>{resource.type === "tool" ? resource.toolId : "tool"}</small>
    </div>
  );
}
