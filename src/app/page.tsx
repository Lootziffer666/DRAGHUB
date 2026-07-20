"use client";
import { WindowManagerProvider, useWindowManager } from "@/features/desktop";
import { DesktopShell } from "@/features/desktop";
import { SearchProvider, repoKeyFromWindow } from "@/features/search";

function DesktopSearchBinding({ children }: { children: React.ReactNode }) {
  const wm = useWindowManager();
  const active = wm.session.windows.find(
    (w) => w.id === wm.session.activeWindowId,
  );
  const relatedRepoKey = repoKeyFromWindow(active);
  return (
    <SearchProvider relatedRepoKey={relatedRepoKey}>{children}</SearchProvider>
  );
}

export default function Page() {
  return (
    <WindowManagerProvider>
      <DesktopSearchBinding>
        <DesktopShell />
      </DesktopSearchBinding>
    </WindowManagerProvider>
  );
}
