"use client";

import { useEffect, useState } from "react";
import { RepoScope, useActiveRepo, useRepoRequest, useStore } from "@/lib/store";
import { ChangesProvider } from "@/features/changes";
import { UIProvider } from "@/components/ui-context";
import { RubberBand } from "@/features/desktop/RubberBand";
import type { WindowContentProps } from "@/features/desktop/types";
import { Spinner } from "@/features/icons";
import { DesktopWindowContext } from "./window-context";
import { WorkspaceDashboard } from "./workspace/WorkspaceDashboard";

// Repositories currently being hydrated, so several windows (or StrictMode
// re-runs) never fire duplicate metadata/root fetches for the same repo.
const inflight = new Set<string>();

/**
 * The real Repository Explorer application (Stage 2 of the post-PR8 brief).
 * It binds the existing DRAGHUB browsing experience — AddressBar, Explorer,
 * Tabs, FileView, working changes — to exactly one repository via
 * `RepoScope`, so two repository windows never share tabs, tree, selection
 * or staged changes. The globally focused repository is irrelevant here.
 */
export function RepositoryExplorerApp({ windowId, resource }: WindowContentProps) {
  const { state, openRepo } = useStore();
  const requestedKey = resource.type === "repository" ? resource.repoKey : "";
  // A hand-typed repo key may differ in case from the API's canonical
  // fullName — resolve case-insensitively against loaded repositories.
  const repoKey =
    (state.repos[requestedKey]
      ? requestedKey
      : Object.keys(state.repos).find(
          (k) => k.toLowerCase() === requestedKey.toLowerCase()
        )) ?? requestedKey;
  const repo = state.repos[repoKey];
  const request = useRepoRequest(requestedKey);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (repo || !requestedKey || inflight.has(requestedKey)) return;
    inflight.add(requestedKey);
    void openRepo(requestedKey).finally(() => inflight.delete(requestedKey));
    // `attempt` re-triggers hydration after an error.
  }, [repo, requestedKey, openRepo, attempt]);

  if (!repo) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-[var(--dh-surface)] p-6 text-center">
        {request.error && !request.loading ? (
          <>
            <p className="max-w-md text-sm text-red-600 dark:text-red-300">{request.error}</p>
            <button
              onClick={() => setAttempt((n) => n + 1)}
              className="rounded-md border border-[var(--dh-window-border)] px-3 py-1.5 text-sm text-[var(--dh-text)] hover:border-[var(--dh-window-border-active)]"
            >
              Retry
            </button>
          </>
        ) : (
          <>
            <Spinner width={22} height={22} className="text-blue-700 dark:text-blue-400" />
            <p className="text-sm text-[var(--dh-text-secondary)]">Loading {requestedKey}…</p>
          </>
        )}
      </div>
    );
  }

  return (
    <DesktopWindowContext.Provider value={{ windowId, repoKey }}>
      <RepoScope repoKey={repoKey}>
        <ChangesProvider>
          <UIProvider>
            <RepositoryWindowBody windowId={windowId} resource={resource} />
          </UIProvider>
        </ChangesProvider>
      </RepoScope>
    </DesktopWindowContext.Provider>
  );
}

/**
 * The repository window's default body: a task-oriented Workspace Dashboard,
 * not a GitHub-website clone. Code/Pull Requests/Issues/Actions/Releases/
 * Security/Settings are deliberately not primary navigation here — they stay
 * reachable through the RubberBand (collapsed by default) as secondary
 * tools, opened intentionally rather than presented as a persistent tab row.
 */
function RepositoryWindowBody({
  windowId,
  resource,
}: Pick<WindowContentProps, "windowId" | "resource">) {
  const repo = useActiveRepo();
  if (!repo) return null;
  const meta = repo.meta;

  return (
    <div className="flex h-full flex-col bg-[var(--dh-surface)] text-[var(--dh-text)]">
      <RubberBand windowId={windowId} resource={resource} />
      <div className="min-h-0 flex-1">
        <WorkspaceDashboard
          windowId={windowId}
          meta={{
            owner: meta.owner,
            repo: meta.repo,
            repoKey: meta.fullName,
            branch: meta.branch,
            htmlUrl: meta.htmlUrl,
          }}
        />
      </div>
    </div>
  );
}
