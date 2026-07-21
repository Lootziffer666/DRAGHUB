"use client";

import { useEffect, useState } from "react";
import { RepoScope, useActiveRepo, useRepoRequest, useStore } from "@/lib/store";
import { parseRepoInput } from "@/lib/github";
import { ChangesProvider, useChanges } from "@/features/changes";
import { UIProvider } from "@/components/ui-context";
import { AddressBar } from "@/components/AddressBar";
import { Explorer } from "@/components/Explorer";
import { Tabs } from "@/components/Tabs";
import { FileView } from "@/components/FileView";
import { RubberBand } from "@/features/desktop/RubberBand";
import { useWindowManager } from "@/features/desktop/WindowManagerProvider";
import type { WindowContentProps } from "@/features/desktop/types";
import {
  BranchForkRegular as GitBranch,
  RecordRegular as GitCommit,
  DocumentRegular as FileIcon,
  Spinner,
} from "@/features/icons";
import { DesktopWindowContext } from "./window-context";
import { OpenWithMenu } from "./file-handlers";
import type { FileHandlerDefinition } from "./file-handlers";

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

function RepositoryWindowBody({
  windowId,
  resource,
}: Pick<WindowContentProps, "windowId" | "resource">) {
  const wm = useWindowManager();
  const repo = useActiveRepo();
  const changes = useChanges();
  if (!repo) return null;
  const repoKey = repo.meta.fullName;
  const repoName = repo.meta.repo;
  const activeTab = repo.tabs.find((t) => t.id === repo.activeTabId);

  const openRepoInput = (input: string) => {
    const parsed = parseRepoInput(input);
    if (!parsed) return;
    const key = `${parsed.owner}/${parsed.repo}`;
    wm.openOrFocusWindow({
      applicationId: "repository-explorer",
      owner: { type: "desktop" },
      resource: { type: "repository", repoKey: key },
      title: key,
    });
  };

  return (
    <div className="flex h-full flex-col bg-[var(--dh-surface)] text-[var(--dh-text)]">
      <RubberBand windowId={windowId} resource={resource} />
      <AddressBar
        onGoHome={() => wm.minimizeWindow(windowId)}
        onOpenRepo={openRepoInput}
        onCloseRepo={() => wm.requestCloseWindow(windowId)}
      />
      <div className="flex items-center gap-2 border-b border-[var(--dh-window-border)] bg-[var(--dh-surface)] px-3 py-1.5">
        <button
          onClick={() =>
            wm.openRepositoryChild(
              windowId,
              "github-feature",
              { type: "github-feature", repoKey, featureId: "changes" },
              `${repoName} — Changes`
            )
          }
          title="Working changes"
          className="relative flex items-center gap-1.5 rounded-md border border-[var(--dh-window-border)] bg-[var(--dh-surface)] px-2.5 py-1 text-xs text-[var(--dh-text-secondary)] hover:border-[var(--dh-window-border-active)]"
        >
          <GitCommit
            width={13}
            height={13}
            className={changes.changes.length > 0 ? "text-amber-700 dark:text-amber-400" : "text-[var(--dh-text-secondary)]"}
          />
          Changes
          {changes.changes.length > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-semibold text-black">
              {changes.changes.length}
            </span>
          )}
        </button>
        {activeTab?.kind === "file" && (
          <OpenWithMenu
            resource={{ repoKey, path: activeTab.path, size: activeTab.size }}
            meta={{ owner: repo.meta.owner, repo: repo.meta.repo, branch: repo.meta.branch }}
            onOpenHandler={(handler: FileHandlerDefinition) =>
              wm.openRepositoryChild(
                windowId,
                handler.applicationId,
                { type: "file", repoKey, path: activeTab.path },
                activeTab.label
              )
            }
          />
        )}
        <span className="ml-auto truncate text-[11px] text-[var(--dh-text-disabled)]">
          {repoKey}
        </span>
      </div>
      <div className="flex min-h-0 flex-1">
        <aside className="w-64 shrink-0 border-r border-[var(--dh-window-border)] max-md:hidden">
          <Explorer />
        </aside>
        <main className="flex min-w-0 flex-1 flex-col">
          <Tabs />
          <div className="min-h-0 flex-1">
            <FileView />
          </div>
        </main>
      </div>
      <div className="flex items-center gap-4 border-t border-[var(--dh-window-border)] bg-[var(--dh-surface)] px-3 py-1 text-[11px] text-[var(--dh-text-secondary)]">
        <span className="flex items-center gap-1">
          <GitBranch width={12} height={12} />
          {repo.meta.branch}
        </span>
        {activeTab && (
          <span className="flex items-center gap-1 truncate">
            <FileIcon width={12} height={12} />
            <span className="truncate">{activeTab.path || "/"}</span>
          </span>
        )}
        <span className="ml-auto">
          {repo.selection.length > 0
            ? `${repo.selection.length} selected`
            : `${repo.tabs.length} tab${repo.tabs.length === 1 ? "" : "s"}`}
        </span>
      </div>
    </div>
  );
}
