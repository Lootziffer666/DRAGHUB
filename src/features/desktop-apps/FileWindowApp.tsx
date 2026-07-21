"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useStore } from "@/lib/store";
import {
  fetchFileContent,
  githubRawUrl,
  formatBytes,
} from "@/lib/github";
import { dbGet } from "@/lib/staging-db";
import { changesFor, subscribeChanges } from "@/features/changes/store";
import { stageEditDirect } from "@/features/changes/ops";
import { tokenizeLines } from "@/lib/highlight";
import { renderMarkdown } from "@/lib/markdown";
import { CodeEditor } from "@/components/CodeEditor";
import {
  openSession,
  getSession,
  updateDraft,
  saveViewState,
  markSaved,
  discardDraft,
  isDirty,
  subscribeDirty,
} from "@/lib/editor-sessions";
import { Spinner } from "@/components/icons";
import type { WindowContentProps } from "@/features/desktop/types";

const IMAGE_EXT = ["png", "jpg", "jpeg", "gif", "svg", "webp", "ico", "bmp", "avif"];

const TOKEN_CLASS: Record<string, string> = {
  comment: "text-[var(--dh-text-secondary)] italic",
  string: "text-emerald-700 dark:text-emerald-400",
  number: "text-amber-700 dark:text-amber-300",
  keyword: "text-violet-700 dark:text-violet-400",
  ident: "text-[var(--dh-text)]",
  ws: "text-[var(--dh-text)]",
  punct: "text-[var(--dh-text-secondary)]",
  plain: "text-[var(--dh-text)]",
};

/** Viewer child application for `file` resources (images, markdown, code). */
export function FileViewerApp(props: WindowContentProps) {
  return <FileWindowApp {...props} mode="viewer" />;
}

/** Editor child application for `file` resources — same CodeMirror editor,
 * draft sessions and staging pipeline as the in-window tab editor. */
export function FileEditorApp(props: WindowContentProps) {
  return <FileWindowApp {...props} mode="editor" />;
}

function FileWindowApp({
  resource,
  mode,
}: WindowContentProps & { mode: "viewer" | "editor" }) {
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
  const [savedFlash, setSavedFlash] = useState(false);
  const [editorNonce, setEditorNonce] = useState(0);

  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const isImage = IMAGE_EXT.includes(ext);
  const isMarkdown = /\.(md|mdx)$/i.test(path);

  const dirty = useSyncExternalStore(
    subscribeDirty,
    () => isDirty(repoKey, path),
    () => false
  );

  // Pending edits (staged working changes) take precedence over remote
  // content, exactly like the repository window's tab view.
  const pending = useSyncExternalStore(
    subscribeChanges,
    () =>
      changesFor(repoKey).find(
        (c) => (c.kind === "add" || c.kind === "modify") && c.path === path
      ) ?? null,
    () => null
  );

  useEffect(() => {
    if (!meta || isImage) return;
    let cancelled = false;
    setError(null);
    setText(null);
    const load = async () => {
      try {
        if (pending?.blobId) {
          const blob = await dbGet(pending.blobId);
          if (blob && !cancelled) {
            setText(new TextDecoder().decode(blob));
            setSize(blob.byteLength);
            return;
          }
        }
        const { content, size } = await fetchFileContent(
          meta.owner,
          meta.repo,
          path,
          meta.branch
        );
        if (!cancelled) {
          setText(content);
          setSize(size);
        }
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load file.");
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
    // pending?.blobId: re-load when a newer draft is staged elsewhere.
  }, [meta, path, isImage, pending?.blobId]);

  if (!repo || !meta) {
    return (
      <Center>
        <Spinner width={20} height={20} className="text-blue-700 dark:text-blue-400" />
        <p className="text-sm text-[var(--dh-text-secondary)]">
          Waiting for repository {requestedKey}…
        </p>
      </Center>
    );
  }

  if (isImage) {
    return (
      <div className="flex h-full flex-col bg-[var(--dh-surface)]">
        <Header path={path} note={meta.branch} />
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4 [background-image:linear-gradient(45deg,#171717_25%,transparent_25%),linear-gradient(-45deg,#171717_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#171717_75%),linear-gradient(-45deg,transparent_75%,#171717_75%)] [background-size:20px_20px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={githubRawUrl(meta.owner, meta.repo, meta.branch, path)}
            alt={path}
            className="max-h-full max-w-full object-contain"
          />
        </div>
      </div>
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

  if (mode === "viewer") {
    return (
      <div className="flex h-full flex-col bg-[var(--dh-surface)]">
        <Header
          path={path}
          note={`${meta.branch}${size !== null ? ` · ${formatBytes(size)}` : ""}${pending ? " · pending edit" : ""}`}
        />
        <div className="min-h-0 flex-1 overflow-auto">
          {isMarkdown ? (
            <div className="max-w-3xl p-5 text-sm">{renderMarkdown(text)}</div>
          ) : (
            <CodeLines content={text} />
          )}
        </div>
      </div>
    );
  }

  // Editor mode
  const session = openSession(repoKey, path, text);
  const save = () => {
    const current = getSession(repoKey, path);
    if (!current) return;
    void stageEditDirect(repoKey, path, current.draft).then(() => {
      markSaved(repoKey, path);
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 1500);
    });
  };

  return (
    <div className="flex h-full flex-col bg-[var(--dh-surface)]">
      <Header
        path={path}
        note={`${meta.branch}${dirty ? " · unsaved draft" : ""}${savedFlash ? " · saved as Working Change" : ""}`}
        right={
          <div className="flex items-center gap-1.5">
            <button
              onClick={save}
              className="rounded bg-blue-600 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-blue-500"
              title="Save as Working Change (Ctrl/Cmd+S)"
            >
              Save
            </button>
            <button
              onClick={() => {
                discardDraft(repoKey, path);
                setEditorNonce((n) => n + 1);
              }}
              disabled={!dirty}
              className="rounded border border-[var(--dh-window-border)] px-2 py-0.5 text-[11px] text-[var(--dh-text-secondary)] hover:border-[var(--dh-window-border-active)] disabled:opacity-40"
            >
              Discard draft
            </button>
          </div>
        }
      />
      <div className="min-h-0 flex-1">
        <CodeEditor
          key={`${repoKey}:${path}:${editorNonce}`}
          path={path}
          initialValue={session.draft}
          initialViewState={
            session.selection
              ? {
                  selection: session.selection,
                  scrollTop: session.scrollTop ?? 0,
                }
              : undefined
          }
          onChange={(value, selection) =>
            updateDraft(repoKey, path, value, selection)
          }
          onSave={save}
          onViewState={(vs) =>
            saveViewState(repoKey, path, vs.selection, vs.scrollTop)
          }
        />
      </div>
    </div>
  );
}

function Header({
  path,
  note,
  right,
}: {
  path: string;
  note?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 border-b border-[var(--dh-window-border)] px-3 py-1.5">
      <span className="min-w-0 truncate text-xs text-[var(--dh-text)]" title={path}>
        {path}
      </span>
      {note && <span className="shrink-0 text-[11px] text-[var(--dh-text-secondary)]">{note}</span>}
      <div className="ml-auto shrink-0">{right}</div>
    </div>
  );
}

function CodeLines({ content }: { content: string }) {
  const lines = useMemo(() => tokenizeLines(content), [content]);
  return (
    <table className="w-full border-collapse font-mono text-[12.5px] leading-relaxed">
      <tbody>
        {lines.map((tokens, i) => (
          <tr key={i}>
            <td className="w-10 select-none pr-3 text-right align-top text-[var(--dh-text-disabled)]">
              {i + 1}
            </td>
            <td className="whitespace-pre-wrap break-all align-top">
              {tokens.map((t, j) => (
                <span key={j} className={TOKEN_CLASS[t.type] ?? "text-[var(--dh-text)]"}>
                  {t.text}
                </span>
              ))}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 bg-[var(--dh-surface)] p-6 text-center">
      {children}
    </div>
  );
}
