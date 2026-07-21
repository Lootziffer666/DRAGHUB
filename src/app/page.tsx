"use client";

import { useMemo, useRef, type ReactNode } from "react";
import { DesktopShell, WindowManagerProvider, useWindowManager } from "@/features/desktop";
import { StoreProvider, useStore } from "@/lib/store";
import { StagingProvider } from "@/lib/staging";
import { SearchProvider, repoKeyFromWindow } from "@/features/search";
import { createDesktopLifecycleAdapter } from "@/features/desktop-apps/lifecycle-adapter";

/**
 * DRAGHUB desktop entry point. The PR #8 window manager stays the shell;
 * the store/staging providers supply the real GitHub domain underneath it,
 * the lifecycle adapter connects window closing to dirty drafts / pending
 * changes, and search opens or focuses repository windows.
 */
export default function Page() {
  return (
    <StoreProvider>
      <StagingProvider>
        <DesktopWithDomain />
      </StagingProvider>
    </StoreProvider>
  );
}

function DesktopWithDomain() {
  const { state } = useStore();
  const stateRef = useRef(state);
  stateRef.current = state;

  // The adapter reads repository state at call time through a ref, so it
  // stays referentially stable and never captures a stale store snapshot.
  const lifecycle = useMemo(
    () =>
      createDesktopLifecycleAdapter((repoKey) => {
        const repos = stateRef.current.repos;
        const key = repos[repoKey]
          ? repoKey
          : Object.keys(repos).find(
              (k) => k.toLowerCase() === repoKey.toLowerCase()
            );
        if (!key) return null;
        const meta = repos[key].meta;
        return {
          key,
          meta: { owner: meta.owner, repo: meta.repo, branch: meta.branch },
        };
      }),
    []
  );

  return (
    <WindowManagerProvider lifecycle={lifecycle}>
      <DesktopSearchBinding>
        <DesktopShell />
      </DesktopSearchBinding>
    </WindowManagerProvider>
  );
}

function DesktopSearchBinding({ children }: { children: ReactNode }) {
  const wm = useWindowManager();
  const activeWindow = wm.session.windows.find(
    (w) => w.id === wm.session.activeWindowId,
  );
  const relatedRepoKey = repoKeyFromWindow(activeWindow);
  return (
    <SearchProvider
      relatedRepoKey={relatedRepoKey}
      onSelectRepo={(fullName) =>
        wm.openOrFocusWindow({
          applicationId: "repository-explorer",
          owner: { type: "desktop" },
          resource: { type: "repository", repoKey: fullName },
          title: fullName,
        })
      }
    >
      {children}
    </SearchProvider>
  );
}
