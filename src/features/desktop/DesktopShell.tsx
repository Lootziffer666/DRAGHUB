"use client";
import { useEffect, useRef } from "react";
import { Button } from "@fluentui/react-components";
import { DraghubMark } from "@/features/icons";
import { deriveCloseScope } from "@/features/desktop-apps/lifecycle-adapter";
import { DesktopCanvas } from "./DesktopCanvas";
import { Dock } from "./Dock";
import { Taskbar } from "./Taskbar";
import { useWindowManager } from "./WindowManagerProvider";
export function DesktopShell() {
  const wm = useWindowManager();
  const dialogRef = useRef<HTMLDivElement>(null);
  const lastClosingId = useRef<string | null>(null);
  const closing = wm.session.windows.find(
    (w) => w.id === wm.session.pendingCloseId,
  );
  const closeScope = closing ? deriveCloseScope(closing) : null;
  const commitLabel =
    closeScope?.mode === "editor"
      ? "Save as Working Change and close"
      : "Create checkpoint and close";
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
          <span>
            <DraghubMark />
          </span>{" "}
          DRAGHUB
        </strong>
        <nav>VIRTUAL GITHUB DESKTOP</nav>
        <div>
          <b>GITHUB</b>
          <span>api.github.com</span>
        </div>
      </header>
      <DesktopCanvas />
      <Dock />
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
              <Button
                appearance="secondary"
                disabled={context.resolutionStatus === "pending"}
                onClick={wm.cancelCloseWindow}
              >
                Cancel
              </Button>
              {context.inspectionStatus === "failed" ? (
                <Button
                  appearance="primary"
                  onClick={() => void wm.retryCloseInspection()}
                >
                  Retry Inspection
                </Button>
              ) : context.inspectionStatus === "ready" &&
                context.resolutionStatus === "idle" &&
                context.blockers.length ? (
                <>
                  <Button
                    appearance="primary"
                    onClick={() =>
                      void wm.resolveCloseWindow({ action: "commit-and-close" })
                    }
                  >
                    {commitLabel}
                  </Button>
                  <Button
                    appearance="secondary"
                    style={{
                      backgroundColor: "var(--dh-danger)",
                      color: "#ffffff",
                    }}
                    onClick={() =>
                      void wm.resolveCloseWindow({
                        action: "discard-to-recycle-bin-and-close",
                      })
                    }
                  >
                    Discard to Recycle Bin and close
                  </Button>
                </>
              ) : context.inspectionStatus === "ready" &&
                context.resolutionStatus === "idle" ? (
                <Button
                  appearance="primary"
                  onClick={() =>
                    void wm.resolveCloseWindow({ action: "close-clean" })
                  }
                >
                  Close window
                </Button>
              ) : null}
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
