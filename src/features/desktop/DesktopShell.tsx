"use client";
import { DesktopCanvas } from "./DesktopCanvas";
import { Taskbar } from "./Taskbar";
import { useWindowManager } from "./WindowManagerProvider";
export function DesktopShell() {
  const wm = useWindowManager();
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
      {closing && (
        <div
          className="close-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="close-title"
        >
          <div>
            <span className="warning">!</span>
            <h2 id="close-title">Close “{closing.title}”?</h2>
            <p>
              {closing.applicationId === "tool-window"
                ? "This demo window may contain an unsaved draft."
                : children?.length
                  ? `${children.length} repository child window(s) will close with it.`
                  : "The window will be removed from this desktop session."}
            </p>
            <small>
              Desktop shortcuts are never removed when a window closes.
            </small>
            <footer>
              <button onClick={wm.cancelCloseWindow}>Cancel</button>
              <button className="danger" onClick={wm.confirmCloseWindow}>
                Close window
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
