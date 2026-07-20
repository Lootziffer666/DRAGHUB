"use client";
import { useEffect, useRef } from "react";
import { DesktopCanvas } from "./DesktopCanvas";
import { Taskbar } from "./Taskbar";
import { useWindowManager } from "./WindowManagerProvider";
export function DesktopShell() {
  const wm = useWindowManager();
  const dialogRef = useRef<HTMLDivElement>(null);
  const lastClosingId = useRef<string | null>(null);
  const closing = wm.session.windows.find(
    (w) => w.id === wm.session.pendingCloseId,
  );
  const children =
    closing &&
    wm.session.windows.filter(
      (w) =>
        w.owner.type === "repository" &&
        w.owner.repositoryWindowId === closing.id,
    );
  const context = wm.session.closeContext;
  useEffect(() => {
    if (context) {
      lastClosingId.current = context.target.id;
      dialogRef.current?.focus();
    } else if (lastClosingId.current)
      document
        .querySelector<HTMLElement>(
          `[data-window-id="${lastClosingId.current}"]`,
        )
        ?.focus();
  }, [context]);
  return (
    <div className="draghub-desktop">
      <header className="desktop-systembar">
        <strong>
          <span>◈</span> DRAGHUB
        </strong>
        <nav>DESKTOP UX FOUNDATION</nav>
        <div>
          <b>DEMO</b>
          <span>Adapter disconnected</span>
        </div>
      </header>
      <DesktopCanvas />
      <Taskbar />
      {closing && context && (
        <div
          className="close-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="close-title"
        >
          <div
            ref={dialogRef}
            tabIndex={-1}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                if (context.resolutionStatus === "idle") wm.cancelCloseWindow();
              }
              if (e.key === "Enter") {
                e.preventDefault();
                if (
                  context.inspectionStatus === "ready" &&
                  context.resolutionStatus === "idle" &&
                  !context.blockers.length
                )
                  void wm.resolveCloseWindow({ action: "close-clean" });
              }
            }}
          >
            <span className="warning">!</span>
            <h2 id="close-title">Close “{closing.title}”?</h2>
            <p>
              {context.inspectionStatus === "pending"
                ? "Checking window state…"
                : context.inspectionStatus === "failed"
                  ? "Window state could not be inspected."
                  : context.resolutionStatus === "pending"
                    ? "Resolving window state…"
                    : context.blockers.length
                      ? `${context.blockers.length} unsaved or running item(s) must be resolved before closing.`
                      : children?.length
                        ? `${children.length} repository child window(s) will close with it.`
                        : "The window will be removed from this desktop session."}
            </p>
            <small>
              Desktop shortcuts are never removed when a window closes.
            </small>
            {context.error && <p className="close-error">{context.error}</p>}
            <footer>
              <button
                disabled={context.resolutionStatus === "pending"}
                onClick={wm.cancelCloseWindow}
              >
                Cancel
              </button>
              {context.inspectionStatus === "failed" ? (
                <button onClick={() => void wm.retryCloseInspection()}>
                  Retry Inspection
                </button>
              ) : context.inspectionStatus === "ready" &&
                context.resolutionStatus === "idle" &&
                context.blockers.length ? (
                <>
                  <button
                    onClick={() =>
                      void wm.resolveCloseWindow({ action: "commit-and-close" })
                    }
                  >
                    Commit / Checkpoint and close
                  </button>
                  <button
                    className="danger"
                    onClick={() =>
                      void wm.resolveCloseWindow({
                        action: "discard-to-recycle-bin-and-close",
                      })
                    }
                  >
                    Discard to Recycle Bin and close
                  </button>
                </>
              ) : context.inspectionStatus === "ready" &&
                context.resolutionStatus === "idle" ? (
                <button
                  className="danger"
                  onClick={() =>
                    void wm.resolveCloseWindow({ action: "close-clean" })
                  }
                >
                  Close window
                </button>
              ) : null}
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
