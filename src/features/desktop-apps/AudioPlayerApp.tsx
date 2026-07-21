"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { getRepositoryBlob, formatBytes } from "@/lib/github";
import { createImageUrlManager } from "@/lib/image-url";
import { MusicNote2Regular as Music, Spinner } from "@/features/icons";
import type { WindowContentProps } from "@/features/desktop/types";

/**
 * Audio player child application for `file` resources. Fetches the binary
 * through the shared repository binary adapter (same authenticated path as
 * every other download — private-repository audio works the same as public)
 * and plays it through an Object URL, so nothing is ever written to desktop
 * persistence. `createImageUrlManager` is a plain Blob → Object URL
 * lifecycle helper despite its name; reused here rather than duplicated.
 */
export function AudioPlayerApp({ resource }: WindowContentProps) {
  const { state } = useStore();
  const requestedKey = resource.type === "file" ? resource.repoKey : "";
  const path = resource.type === "file" ? resource.path : "";
  const repoKey =
    (state.repos[requestedKey]
      ? requestedKey
      : Object.keys(state.repos).find(
          (k) => k.toLowerCase() === requestedKey.toLowerCase()
        )) ?? requestedKey;
  const repo = state.repos[repoKey];
  const meta = repo?.meta ?? null;

  const [manager] = useState(() => createImageUrlManager());
  const [view, setView] = useState<{
    url: string | null;
    loading: boolean;
    error: string | null;
    size: number | null;
  }>({ url: null, loading: true, error: null, size: null });

  useEffect(() => {
    if (!meta) return;
    let cancelled = false;
    setView({ url: null, loading: true, error: null, size: null });
    getRepositoryBlob({ owner: meta.owner, repo: meta.repo, branch: meta.branch, path })
      .then((blob) => {
        if (cancelled) return;
        const url = manager.create(blob);
        setView({ url, loading: false, error: null, size: blob.size });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setView({
          url: null,
          loading: false,
          error: err instanceof Error ? err.message : String(err),
          size: null,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [meta, path, manager]);

  useEffect(() => {
    return () => manager.revoke();
  }, [manager]);

  if (!repo || !meta) {
    return (
      <Center>
        <Spinner width={20} height={20} className="text-blue-700 dark:text-blue-400" />
        <p className="text-sm text-[var(--dh-text-secondary)]">Waiting for repository {requestedKey}…</p>
      </Center>
    );
  }

  return (
    <Center>
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--dh-surface-raised)] text-[var(--dh-text-secondary)]">
        <Music width={26} height={26} />
      </div>
      <p className="max-w-full truncate text-sm text-[var(--dh-text)]" title={path}>
        {path.split("/").pop()}
      </p>
      <p className="text-[11px] text-[var(--dh-text-secondary)]">
        {meta.branch}
        {view.size !== null ? ` · ${formatBytes(view.size)}` : ""}
      </p>
      {view.loading && <Spinner width={20} height={20} className="text-blue-700 dark:text-blue-400" />}
      {view.error && <p className="max-w-md text-sm text-red-600 dark:text-red-300">{view.error}</p>}
      {view.url && <audio controls src={view.url} className="w-full max-w-sm" />}
    </Center>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 bg-[var(--dh-surface)] p-6 text-center">
      {children}
    </div>
  );
}
