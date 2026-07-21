"use client";

import { useEffect, useState } from "react";
import { RepoScope, useRepoRequest, useStore } from "@/lib/store";
import { fetchTreeRecursive } from "@/lib/github";
import { fetchVitality } from "@/lib/vitality";
import type { Vitality } from "@/lib/vitality";
import type { WindowContentProps } from "@/features/desktop/types";
import { Spinner } from "@/features/icons";
import { DesktopWindowContext } from "@/features/desktop-apps/window-context";
import { buildWorldModel, type WorldModel } from "./scene/world-model";
import { Scene } from "./scene/Scene";

const inflight = new Set<string>();

/**
 * Phase-2 M13: static world render for one repository's top-level files.
 * Mirrors RepositoryExplorerApp's RepoScope/DesktopWindowContext wiring
 * exactly (docs/PHASE_2_REPO_WORLD_PLAN.md §4.2) so this window never reads
 * a global active-repo pointer.
 */
export function RepoWorldApp({ windowId, resource }: WindowContentProps) {
  const { state, openRepo } = useStore();
  const requestedKey = resource.type === "repository" ? resource.repoKey : "";
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
        <RepoWorldBody
          windowId={windowId}
          owner={repo.meta.owner}
          repoName={repo.meta.repo}
          branch={repo.meta.branch}
        />
      </RepoScope>
    </DesktopWindowContext.Provider>
  );
}

function RepoWorldBody({
  windowId,
  owner,
  repoName,
  branch,
}: {
  windowId: string;
  owner: string;
  repoName: string;
  branch: string;
}) {
  const [model, setModel] = useState<WorldModel | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setModel(null);
    setError(null);
    (async () => {
      try {
        const tree = await fetchTreeRecursive(owner, repoName, branch);
        const topLevelBlobs = tree.filter(
          (entry) => entry.type === "blob" && !entry.path.includes("/")
        );
        const vitalityByPath = new Map<string, Vitality>();
        await Promise.all(
          topLevelBlobs.map(async (entry) => {
            const vitality = await fetchVitality(owner, repoName, branch, entry.path);
            vitalityByPath.set(entry.path, vitality);
          })
        );
        if (cancelled) return;
        setModel(buildWorldModel(topLevelBlobs, vitalityByPath));
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load repository world.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [owner, repoName, branch]);

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-[var(--dh-surface)] p-6 text-center">
        <p className="max-w-md text-sm text-red-600 dark:text-red-300">{error}</p>
      </div>
    );
  }

  if (!model) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-[var(--dh-surface)] p-6 text-center">
        <Spinner width={22} height={22} className="text-blue-700 dark:text-blue-400" />
        <p className="text-sm text-[var(--dh-text-secondary)]">Building world…</p>
      </div>
    );
  }

  return <Scene windowId={windowId} model={model} />;
}
