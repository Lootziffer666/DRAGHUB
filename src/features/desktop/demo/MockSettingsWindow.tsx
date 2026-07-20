import type { WindowContentProps } from "../types";
import { useWindowManager } from "../WindowManagerProvider";
export function MockSettingsWindow(_props: WindowContentProps) {
  const wm = useWindowManager();
  return (
    <div className="mock-panel">
      <span className="demo-pill">SYSTEM DEMO</span>
      <h2>Desktop Settings</h2>
      <p>
        The isolated desktop layer stores lightweight window, icon, and mock
        lifecycle state.
      </p>
      <button onClick={wm.resetDesktopSession}>Reset desktop session</button>
    </div>
  );
}
