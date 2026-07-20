import type { WindowContentProps } from "../types";
import { useWindowManager } from "../WindowManagerProvider";
export function MockSystemWindow({ resource }: WindowContentProps) {
  const wm = useWindowManager();
  const id = resource.type === "system" ? resource.systemId : "settings";
  return (
    <div className="mock-panel">
      <span className="demo-pill">SYSTEM DEMO</span>
      <h2>{id === "recycle-bin" ? "Recycle Bin" : "Desktop Settings"}</h2>
      <p>
        {id === "recycle-bin"
          ? "Shortcuts removed from the desktop would appear here. Remote repositories are never deleted."
          : "The isolated desktop layer stores only lightweight window and icon state."}
      </p>
      {id !== "recycle-bin" && (
        <button onClick={wm.resetDesktopSession}>Reset desktop session</button>
      )}
    </div>
  );
}
