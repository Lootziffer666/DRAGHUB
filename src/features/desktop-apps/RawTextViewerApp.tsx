"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { fetchFileContent, formatBytes } from "@/lib/github";
import { Spinner } from "@/features/icons";
import type { WindowContentProps } from "@/features/desktop/types";
import { CodeLines } from "./FileWindowApp";

/**
 * "Raw Text" child application for `file` resources: always shows the file's
 * literal source, even for Markdown, with no rendering. Distinct from the
 * "image-viewer" application's Markdown Preview and from the tab editor —
 * a dedicated applicationId so both can be open for the same file at once.
 */
export function RawTextViewerApp({ resource }: WindowContentProps) {
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

  const [text, setText] = useState<string | null>(null);
  const [size, setSize] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!meta) return;
    let cancelled = false;
    setError(null);
    setText(null);
    fetchFileContent(meta.owner, meta.repo, path, meta.branch)
      .then(({ content, size }) => {
        if (cancelled) return;
        setText(content);
        setSize(size);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load file.");
      });
    return () => {
      cancelled = true;
    };
  }, [meta, path]);

  if (!repo || !meta) {
    return (
      <Center>
        <Spinner width={20} height={20} className="text-blue-700 dark:text-blue-400" />
        <p className="text-sm text-[var(--dh-text-secondary)]">Waiting for repository {requestedKey}…</p>
      </Center>
    );
  }

  if (error) {
    return (
      <Center>
        <p className="max-w-md text-sm text-red-600 dark:text-red-300">{error}</p>
      </Center>
    );
  }

  if (text === null) {
    return (
      <Center>
        <Spinner width={20} height={20} className="text-blue-700 dark:text-blue-400" />
        <p className="text-sm text-[var(--dh-text-secondary)]">Loading {path}…</p>
      </Center>
    );
  }

  return (
    <div className="flex h-full flex-col bg-[var(--dh-surface)]">
      <div className="flex items-center gap-2 border-b border-[var(--dh-window-border)] px-3 py-1.5">
        <span className="min-w-0 truncate text-xs text-[var(--dh-text)]" title={path}>
          {path}
        </span>
        <span className="shrink-0 text-[11px] text-[var(--dh-text-secondary)]">
          {meta.branch}
          {size !== null ? ` · ${formatBytes(size)}` : ""} · raw
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <CodeLines content={text} />
      </div>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 bg-[var(--dh-surface)] p-6 text-center">
      {children}
    </div>
  );
}
