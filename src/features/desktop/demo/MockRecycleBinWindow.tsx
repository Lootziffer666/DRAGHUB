"use client";
import { useState } from "react";
import type { WindowContentProps } from "../types";
import { useWindowManager } from "../WindowManagerProvider";
export function MockRecycleBinWindow(_props: WindowContentProps) {
  const wm = useWindowManager();
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="mock-panel">
      <span className="demo-pill">LOCAL RETENTION DEMO</span>
      <h2>Recycle Bin</h2>
      <p>
        Discarded changes only. Repositories and desktop shortcuts are never
        deleted.
      </p>
      {wm.session.recycleBin.map((entry) => (
        <div className="mock-row" key={entry.id}>
          <span>
            <b>{entry.label}</b>
            <small>
              {entry.repoKey ?? "Global"} · {entry.path ?? "No path"} ·{" "}
              {entry.kind} · {new Date(entry.discardedAt).toLocaleString()}
            </small>
          </span>
          <button onClick={() => void wm.restoreRecycleEntry(entry.id)}>
            Restore
          </button>
          <button onClick={() => wm.deleteRecycleEntry(entry.id)}>
            Delete permanently
          </button>
        </div>
      ))}
      {!wm.session.recycleBin.length && <p>The Recycle Bin is empty.</p>}
      {wm.session.restoredItems.map((x) => (
        <p className="restore-success" key={x.id}>
          Restored: {x.label}
        </p>
      ))}
      {wm.session.recycleError && (
        <p className="close-error">{wm.session.recycleError}</p>
      )}
      {confirm ? (
        <>
          <p>Delete all retained entries permanently?</p>
          <button
            onClick={() => {
              wm.emptyRecycleBin();
              setConfirm(false);
            }}
          >
            Confirm empty
          </button>
          <button onClick={() => setConfirm(false)}>Cancel</button>
        </>
      ) : (
        <button
          disabled={!wm.session.recycleBin.length}
          onClick={() => setConfirm(true)}
        >
          Empty Recycle Bin
        </button>
      )}
    </div>
  );
}
