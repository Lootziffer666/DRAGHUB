"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useActiveRepo, useStore } from "@/lib/store";
import { useUI } from "./ui-context";
import type { MenuItem } from "./ContextMenu";
import { GH_NODE_MIME, type GhNodeDrag } from "@/lib/dnd";
import {
  ChevronRightRegular as ChevronRight,
  CopyRegular as Copy,
  ArrowDownloadRegular as Download,
  OpenRegular as ExternalLink,
  DocumentRegular as FileIcon,
  ImageRegular as FileImage,
  DocumentTextRegular as FileText,
  FolderOpenRegular as FolderOpen,
  ArrowClockwiseRegular as Refresh,
  ClockRegular as History,
  BranchForkRegular as BranchIcon,
  Spinner,
} from "@/features/icons";
import {
  fetchRepositoryBlob,
  fetchFileHistory,
  formatBytes,
  type FileHistoryEntry,
  type GithubEntry,
} from "@/lib/github";
import { createBranchFromSha } from "@/lib/github-write";
import { createImageUrlManager } from "@/lib/image-url";
import { parseLfsPointer, downloadLfsObject } from "@/lib/lfs";
import { parseConflictHunks } from "@/lib/merge";
import { useChanges } from "@/features/changes";
import { tokenizeLines } from "@/lib/highlight";
import { CodeEditor } from "./CodeEditor";
import { renderMarkdown } from "@/lib/markdown";
import {
  openSession as openEditorSession,
  getSession as getEditorSession,
  updateDraft as updateEditorDraft,
  saveViewState as saveEditorViewState,
  markSaved as markEditorSaved,
  discardDraft as discardEditorDraft,
  isDirty as isSessionDirty,
} from "@/lib/editor-sessions";

const IMAGE_EXT = ["png", "jpg", "jpeg", "gif", "svg", "webp", "ico", "bmp", "avif"];

/**
 * Authenticated image viewer. Fetches the binary via fetchRepositoryBlob
 * (same GitHub token path as every other request) and renders it through an
 * object URL, so private-repository images load without leaking the path to
 * an unauthenticated raw.githubusercontent.com request. No blob is
 * persisted into Desktop persistence. The object URL is revoked on unmount
 * and whenever a new resource key loads.
 */
export function ImageViewer({
  owner,
  repo,
  branch,
  path,
}: {
  owner: string;
  repo: string;
  branch: string;
  path: string;
}) {
  const manager = useMemo(() => createImageUrlManager(), []);
  const [view, setView] = useState<{
    url: string | null;
    loading: boolean;
    error: string | null;
  }>({ url: null, loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    setView({ url: null, loading: true, error: null });
    fetchRepositoryBlob({ owner, repo, branch, path })
      .then((blob) => {
        if (cancelled) return;
        const objectUrl = manager.create(blob);
        setView({ url: objectUrl, loading: false, error: null });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setView({
          url: null,
          loading: false,
          error: err instanceof Error ? err.message : String(err),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [owner, repo, branch, path, manager]);

  useEffect(() => {
    return () => manager.revoke();
  }, [manager]);

  if (view.loading) {
    return (
      <div className="flex justify-center p-6">
        <Spinner width={18} height={18} className="text-blue-700 dark:text-blue-400" />
      </div>
    );
  }
  if (view.error) {
    return <p className="p-4 text-red-600 dark:text-red-400">{view.error}</p>;
  }
  return (
    <div className="dh-image-checker flex justify-center rounded-lg p-6">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={view.url ?? ""}
        alt={path.split("/").pop()}
        className="max-h-full max-w-full rounded-lg border border-[var(--dh-window-border)]"
      />
    </div>
  );
}

function fileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (IMAGE_EXT.includes(ext))
    return <FileImage width={16} height={16} className="shrink-0 text-pink-700 dark:text-pink-400" />;
  if (["md", "txt", "mdx", "rst"].includes(ext))
    return <FileText width={16} height={16} className="shrink-0 text-[var(--dh-text-secondary)]" />;
  return <FileIcon width={16} height={16} className="shrink-0 text-sky-700 dark:text-sky-400" />;
}

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

export function FileView() {
  const {
    state,
    openPath,
    openInNewTab,
    setSelection,
    setActiveTab,
    loadFolderTab,
    ensureDir,
    setViewMode,
  } = useStore();
  const repo = useActiveRepo();
  const { openMenu } = useUI();

  const activeRepo = repo!;
  const activeTab =
    activeRepo.tabs.find((t) => t.id === activeRepo.activeTabId) ?? null;
  const meta = activeRepo.meta;
  const anchor = useRef<string | null>(null);

  useEffect(() => {
    if (
      activeTab &&
      activeTab.kind === "dir" &&
      activeTab.entriesState !== "loaded" &&
      meta
    ) {
      void loadFolderTab(activeTab.id, activeTab.path);
    }
  }, [activeTab, meta, loadFolderTab]);

  if (!meta) return null;

  if (!activeTab) {
    return (
      <div className="flex h-full items-center justify-center text-[var(--dh-text-disabled)]">
        No tab open. Pick a file or folder from the Explorer.
      </div>
    );
  }

  const breadcrumbs = buildBreadcrumbs(activeTab.path, meta.fullName);

  function copy(text: string) {
    navigator.clipboard?.writeText(text).catch(() => {});
  }

  function nodeMenu(node: GithubEntry): MenuItem[] {
    if (!meta) return [];
    const ghUrl = `${meta.htmlUrl}/${node.type === "dir" ? "tree" : "blob"}/${meta.branch}/${node.path}`;
    const items: MenuItem[] = [
      {
        id: "open",
        label: "Open",
        shortcut: "↵",
        onClick: () => openPath(node.path, node.type),
      },
      {
        id: "open-new",
        label: "Open in New Tab",
        onClick: () => openInNewTab(node.path, node.type),
      },
    ];
    if (node.type === "dir") {
      items.push({
        id: "refresh",
        label: "Refresh",
        icon: <Refresh width={15} height={15} />,
        separatorBefore: true,
        onClick: () => {
          delete (activeRepo.treeCache as Record<string, unknown>)[node.path];
          void ensureDir(node.path);
        },
      });
    }
    items.push(
      {
        id: "copy-path",
        label: "Copy path",
        icon: <Copy width={15} height={15} />,
        separatorBefore: true,
        onClick: () => copy(node.path),
      },
      {
        id: "gh",
        label: "Open on GitHub",
        icon: <ExternalLink width={15} height={15} />,
        onClick: () => window.open(ghUrl, "_blank", "noreferrer"),
      }
    );
    if (node.type === "file") {
      items.push({
        id: "download",
        label: "Download",
        icon: <Download width={15} height={15} />,
        onClick: () =>
          window.open(
            `https://raw.githubusercontent.com/${meta.owner}/${meta.repo}/${meta.branch}/${node.path}`,
            "_blank",
            "noreferrer"
          ),
      });
    }
    return items;
  }

  function onContextMenu(e: React.MouseEvent, node: GithubEntry) {
    e.preventDefault();
    if (!activeRepo.selection.includes(node.path)) {
      setSelection([node.path]);
      anchor.current = node.path;
    }
    openMenu(e.clientX, e.clientY, nodeMenu(node));
  }

  function select(
    node: GithubEntry,
    siblings: GithubEntry[],
    mod: "none" | "ctrl" | "shift"
  ) {
    if (mod === "ctrl") {
      const next = activeRepo.selection.includes(node.path)
        ? activeRepo.selection.filter((p) => p !== node.path)
        : [...activeRepo.selection, node.path];
      setSelection(next);
      anchor.current = node.path;
      return;
    }
    if (mod === "shift" && anchor.current) {
      const a = siblings.findIndex((s) => s.path === anchor.current);
      const b = siblings.findIndex((s) => s.path === node.path);
      if (a !== -1 && b !== -1) {
        const [lo, hi] = a < b ? [a, b] : [b, a];
        setSelection(siblings.slice(lo, hi + 1).map((s) => s.path));
        return;
      }
    }
    setSelection([node.path]);
    anchor.current = node.path;
  }

  const modifiers = (e: React.MouseEvent): "none" | "ctrl" | "shift" => {
    if (e.metaKey || e.ctrlKey) return "ctrl";
    if (e.shiftKey) return "shift";
    return "none";
  };

  return (
    <div className="flex h-full flex-col bg-[var(--dh-surface-raised)]">
      <div className="flex items-center gap-1 border-b border-[var(--dh-window-border)] bg-[var(--dh-surface)] px-3 py-2 text-[13px]">
        {breadcrumbs.map((b, i) => (
          <span key={b.path} className="flex items-center gap-1">
            {i > 0 && (
              <ChevronRight width={14} height={14} className="text-[var(--dh-text-disabled)]" />
            )}
            <button
              onClick={() => openPath(b.path, "dir")}
              className={[
                "rounded px-1.5 py-0.5 hover:bg-[var(--dh-surface-hover)]",
                i === breadcrumbs.length - 1
                  ? "font-semibold text-[var(--dh-text)]"
                  : "text-blue-700 dark:text-blue-400",
              ].join(" ")}
            >
              {b.name}
            </button>
          </span>
        ))}
      </div>

      {activeTab.kind === "dir" ? (
        <FolderView
          tab={activeTab}
          onOpenPath={openPath}
          onOpenNew={openInNewTab}
          onSelect={select}
          onContextMenu={onContextMenu}
          modifiers={modifiers}
          selection={activeRepo.selection}
          meta={meta}
          viewMode={activeRepo.viewMode}
          onViewMode={setViewMode}
        />
      ) : (
        <FileContentView
          key={activeTab.id}
          tab={activeTab}
          repoKey={activeTab.repoKey}
          meta={meta}
          onOpenPath={openPath}
          onCopy={copy}
        />
      )}
    </div>
  );
}

function buildBreadcrumbs(path: string, rootName: string) {
  const crumbs = [{ name: rootName, path: "" }];
  if (path) {
    const parts = path.split("/");
    let acc = "";
    for (const p of parts) {
      acc = acc ? `${acc}/${p}` : p;
      crumbs.push({ name: p, path: acc });
    }
  }
  return crumbs;
}

function FolderView({
  tab,
  onOpenPath,
  onOpenNew,
  onSelect,
  onContextMenu,
  modifiers,
  selection,
  meta,
  viewMode,
  onViewMode,
}: {
  tab: { path: string; entries?: GithubEntry[]; entriesState: string };
  onOpenPath: (p: string, k: "file" | "dir") => void;
  onOpenNew: (p: string, k: "file" | "dir") => void;
  onSelect: (
    n: GithubEntry,
    s: GithubEntry[],
    m: "none" | "ctrl" | "shift"
  ) => void;
  onContextMenu: (e: React.MouseEvent, n: GithubEntry) => void;
  modifiers: (e: React.MouseEvent) => "none" | "ctrl" | "shift";
  selection: string[];
  meta: { owner: string; repo: string; branch: string; fullName?: string };
  viewMode: "list" | "grid" | "city";
  onViewMode: (mode: "list" | "grid" | "city") => void;
}) {
  const entries = tab.entries ?? [];
  const lpTimer = useRef<number | null>(null);
  const lpFired = useRef(false);
  const lpStart = useRef<{ x: number; y: number } | null>(null);

  function startLP(e: React.PointerEvent, node: GithubEntry) {
    lpFired.current = false;
    lpStart.current = { x: e.clientX, y: e.clientY };
    lpTimer.current = window.setTimeout(() => {
      lpFired.current = true;
      const ev = new MouseEvent("contextmenu", {
        bubbles: true,
        clientX: e.clientX,
        clientY: e.clientY,
      });
      (e.target as HTMLElement).dispatchEvent(ev);
    }, 500);
  }
  function clearLP() {
    if (lpTimer.current) {
      clearTimeout(lpTimer.current);
      lpTimer.current = null;
    }
  }

  if (tab.entriesState === "loading" && entries.length === 0) {
    return (
      <div className="flex items-center gap-2 p-4 text-[var(--dh-text-secondary)]">
        <Spinner width={15} height={15} className="text-blue-700 dark:text-blue-400" />
        Loading…
      </div>
    );
  }
  if (tab.entriesState === "error") {
    return <div className="p-4 text-red-600 dark:text-red-400">Failed to load folder.</div>;
  }

  if (viewMode === "grid") {
    return (
      <div className="flex-1 overflow-auto p-3">
        <div className="mb-3 flex justify-end gap-1 text-xs"><button onClick={() => onViewMode("list")} className="rounded bg-[var(--dh-surface-hover)] px-2 py-1 text-[var(--dh-text-secondary)]">List</button><button onClick={() => onViewMode("grid")} className="rounded bg-[var(--dh-accent)] px-2 py-1 text-[var(--dh-accent-foreground)]">Grid</button></div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-3">
          {entries.map((e) => { const selected = selection.includes(e.path); return (
            <button key={e.path} draggable onDragStart={(ev) => { const payload: GhNodeDrag = { path: e.path, kind: e.type }; ev.dataTransfer.setData(GH_NODE_MIME, JSON.stringify(payload)); }} onClick={(ev) => onSelect(e, entries, modifiers(ev))} onDoubleClick={() => onOpenPath(e.path, e.type)} onContextMenu={(ev) => onContextMenu(ev, e)} className={["flex h-28 flex-col items-center justify-center gap-2 rounded-lg border p-2 text-center hover:bg-[var(--dh-surface-hover)]", selected ? "border-[var(--dh-accent)] bg-[var(--dh-accent)]/20" : "border-[var(--dh-window-border)] bg-[var(--dh-surface-raised)]"].join(" ")}>
              {e.type === "dir" ? <FolderOpen width={28} height={28} className="text-amber-700 dark:text-amber-400" /> : fileIcon(e.name)}
              <span className="line-clamp-2 text-xs text-[var(--dh-text)]">{e.name}</span>
              <span className="text-[10px] text-[var(--dh-text-secondary)]">{e.type === "dir" ? "Folder" : formatBytes(e.size)}</span>
            </button> ); })}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="sticky top-0 z-20 flex justify-end gap-1 border-b border-[var(--dh-window-border)] bg-[var(--dh-surface)] px-3 py-2 text-xs"><button onClick={() => onViewMode("list")} className="rounded bg-[var(--dh-accent)] px-2 py-1 text-[var(--dh-accent-foreground)]">List</button><button onClick={() => onViewMode("grid")} className="rounded bg-[var(--dh-surface-hover)] px-2 py-1 text-[var(--dh-text-secondary)]">Grid</button></div>
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="sticky top-0 z-10 border-b border-[var(--dh-window-border)] bg-[var(--dh-surface)] text-left text-[11px] uppercase tracking-wider text-[var(--dh-text-secondary)]">
            <th className="px-3 py-2 font-medium">Name</th>
            <th className="px-3 py-2 font-medium">Size</th>
            <th className="hidden px-3 py-2 font-medium sm:table-cell">Type</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => {
            const selected = selection.includes(e.path);
            return (
              <tr
                key={e.path}
                draggable
                onDragStart={(ev) => {
                  const payload: GhNodeDrag = { path: e.path, kind: e.type };
                  ev.dataTransfer.effectAllowed = "copyLink";
                  ev.dataTransfer.setData(GH_NODE_MIME, JSON.stringify(payload));
                  ev.dataTransfer.setData("text/plain", e.path);
                  if (!selected) onSelect(e, entries, "none");
                }}
                onClick={(ev) => {
                  if (lpFired.current) {
                    lpFired.current = false;
                    return;
                  }
                  onSelect(e, entries, modifiers(ev));
                }}
                onDoubleClick={() => onOpenPath(e.path, e.type)}
                onAuxClick={(ev) => {
                  if (ev.button === 1) {
                    ev.preventDefault();
                    onOpenNew(e.path, e.type);
                  }
                }}
                onContextMenu={(ev) => onContextMenu(ev, e)}
                onPointerDown={(ev) => {
                  if (ev.pointerType === "touch") startLP(ev, e);
                }}
                onPointerMove={(ev) => {
                  if (lpStart.current) {
                    const dx = Math.abs(ev.clientX - lpStart.current.x);
                    const dy = Math.abs(ev.clientY - lpStart.current.y);
                    if (dx > 10 || dy > 10) clearLP();
                  }
                }}
                onPointerUp={clearLP}
                onPointerLeave={clearLP}
                className={[
                  "cursor-pointer border-b border-[var(--dh-window-border)]/50 hover:bg-[var(--dh-surface-hover)]/50",
                  selected ? "bg-[var(--dh-accent)]/20" : "",
                ].join(" ")}
              >
                <td className="px-3 py-1.5">
                  <div className="flex items-center gap-2 text-[var(--dh-text)]">
                    {e.type === "dir" ? (
                      <FolderOpen
                        width={16}
                        height={16}
                        className="shrink-0 text-amber-700 dark:text-amber-400"
                      />
                    ) : (
                      fileIcon(e.name)
                    )}
                    <span className="truncate">{e.name}</span>
                  </div>
                </td>
                <td className="px-3 py-1.5 text-[var(--dh-text-secondary)]">
                  {e.type === "dir" ? "—" : formatBytes(e.size)}
                </td>
                <td className="hidden px-3 py-1.5 text-[var(--dh-text-secondary)] sm:table-cell">
                  {e.type === "dir" ? "Folder" : e.name.split(".").pop()?.toUpperCase() || "File"}
                </td>
              </tr>
            );
          })}
          {entries.length === 0 && (
            <tr>
              <td colSpan={3} className="px-3 py-8 text-center text-[var(--dh-text-disabled)]">
                Empty folder
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/** Files at/above this size require an explicit confirmation before the
 * editor loads them (M3b: "Schutz vor ungefragtem Laden oder Editieren
 * ungeeignet großer Dateien"). */
const EDITOR_SIZE_GUARD_BYTES = 1_000_000;

function FileContentView({
  tab,
  repoKey,
  meta,
  onOpenPath,
  onCopy,
}: {
  tab: {
    id: string;
    path: string;
    content?: string;
    contentState: string;
    contentError?: string;
    language?: string;
    size?: number;
    ref?: string;
    refLabel?: string;
  };
  repoKey: string;
  meta: { owner: string; repo: string; branch: string; htmlUrl: string };
  onOpenPath: (p: string, k: "file" | "dir") => void;
  onCopy: (t: string) => void;
}) {
  const isImage = IMAGE_EXT.includes(
    tab.path.split(".").pop()?.toLowerCase() ?? ""
  );
  const isMarkdown = /\.(md|mdx)$/i.test(tab.path);
  const isHistorical = Boolean(tab.ref);
  const parent = tab.path.includes("/")
    ? tab.path.slice(0, tab.path.lastIndexOf("/"))
    : "";
  const { stageEdit } = useChanges();
  const { openFileAtRef, markTabBranchedOff } = useStore();
  const [editing, setEditing] = useState(false);
  const [mdPreview, setMdPreview] = useState(isMarkdown);
  const [sizeGuardAccepted, setSizeGuardAccepted] = useState(false);
  const [dirty, setDirty] = useState(() => isSessionDirty(repoKey, tab.path));
  const [savedFlash, setSavedFlash] = useState(false);
  const [resetNonce, setResetNonce] = useState(0);
  const [editPreview, setEditPreview] = useState(false);
  const [lfsProgress, setLfsProgress] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<FileHistoryEntry[] | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [branchPrompt, setBranchPrompt] = useState<{ sha: string } | null>(null);
  const lfsPointer = parseLfsPointer(tab.content);
  const conflictHunks = useMemo(() => parseConflictHunks(tab.content ?? ""), [tab.content]);

  const contentBytes = tab.size ?? tab.content?.length ?? 0;
  const needsSizeGuard = contentBytes >= EDITOR_SIZE_GUARD_BYTES && !sizeGuardAccepted;

  // A dirty draft from a previous visit (tab/repo switch or reload) must
  // resurface instead of being silently lost — reopen the editor on it.
  // Historical tabs never auto-enter edit mode; the only way in is
  // branching off (below), since a draft keyed by repoKey+path could
  // otherwise leak in from an unrelated branch-tip tab on the same path.
  useEffect(() => {
    if (dirty && !editing && !isImage && !lfsPointer && !isHistorical && tab.contentState === "loaded") {
      setEditing(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab.contentState]);

  const openHistory = () => {
    setHistoryOpen((v) => !v);
    if (!history && !historyError) {
      fetchFileHistory(meta.owner, meta.repo, tab.path, meta.branch)
        .then(setHistory)
        .catch((e) => setHistoryError(e instanceof Error ? e.message : "File history unavailable."));
    }
  };

  const branchOff = async (branchName: string) => {
    if (!tab.ref) return;
    await createBranchFromSha(meta.owner, meta.repo, branchName, tab.ref);
    markTabBranchedOff(tab.id, branchName);
    setBranchPrompt(null);
    setEditing(true);
  };

  const session =
    editing && tab.contentState === "loaded"
      ? openEditorSession(repoKey, tab.path, tab.content ?? "")
      : null;

  const save = () => {
    const current = getEditorSession(repoKey, tab.path);
    if (!current) return;
    void stageEdit(tab.path, new TextEncoder().encode(current.draft), "edit").then(() => {
      markEditorSaved(repoKey, tab.path);
      setDirty(false);
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 1500);
    });
  };

  const lines = useMemo(
    () => (tab.content ? tokenizeLines(tab.content) : []),
    [tab.content]
  );

  const CAP = 4000;
  const truncated = lines.length > CAP;
  const shownLines = truncated ? lines.slice(0, CAP) : lines;

  if (tab.contentState === "loading") {
    return (
      <div className="flex items-center gap-2 p-4 text-[var(--dh-text-secondary)]">
        <Spinner width={15} height={15} className="text-blue-700 dark:text-blue-400" />
        Loading {tab.path.split("/").pop()}…
      </div>
    );
  }
  if (tab.contentState === "error") {
    return (
      <div className="p-4 text-red-600 dark:text-red-400">
        {tab.contentError ?? "Failed to load file."}
      </div>
    );
  }

  const rawUrl = `https://raw.githubusercontent.com/${meta.owner}/${meta.repo}/${meta.branch}/${tab.path}`;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-[var(--dh-window-border)] bg-[var(--dh-surface)] px-3 py-1.5 text-[13px]">
        {fileIcon(tab.path.split("/").pop() ?? "")}
        <span className="font-medium text-[var(--dh-text)]">
          {tab.path.split("/").pop()}
        </span>
        {tab.language && (
          <span className="rounded bg-[var(--dh-surface-hover)] px-1.5 py-0.5 text-[11px] text-[var(--dh-text-secondary)]">
            {tab.language}
          </span>
        )}
        {typeof tab.size === "number" && (
          <span className="text-[11px] text-[var(--dh-text-secondary)]">
            {formatBytes(tab.size)}
          </span>
        )}
        {dirty && (
          <span
            title="Unsaved draft — save stages it as a Working Change"
            className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400"
          >
            unsaved draft
          </span>
        )}
        {isHistorical && (
          <span
            title="Pinned to a historical commit, not the branch tip"
            className="rounded bg-violet-500/20 px-1.5 py-0.5 text-[11px] font-medium text-violet-700 dark:text-violet-400"
          >
            {tab.refLabel ?? "historical"}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          {!isImage && !lfsPointer && (
            <button
              onClick={() => (isHistorical ? setBranchPrompt({ sha: tab.ref! }) : setEditing((v) => !v))}
              className="rounded px-2 py-1 text-[var(--dh-text-secondary)] hover:bg-[var(--dh-surface-hover)] hover:text-[var(--dh-text)]"
            >
              {isHistorical ? "Branch off to edit" : editing ? "View" : "Edit"}
            </button>
          )}
          {!isImage && !isHistorical && (
            <button
              onClick={openHistory}
              title="File history"
              className={[
                "flex items-center gap-1 rounded px-2 py-1 hover:bg-[var(--dh-surface-hover)] hover:text-[var(--dh-text)]",
                historyOpen ? "text-[var(--dh-text)]" : "text-[var(--dh-text-secondary)]",
              ].join(" ")}
            >
              <History width={14} height={14} /> History
            </button>
          )}
          {isMarkdown && !editing && (
            <button
              onClick={() => setMdPreview((v) => !v)}
              className="rounded px-2 py-1 text-[var(--dh-text-secondary)] hover:bg-[var(--dh-surface-hover)] hover:text-[var(--dh-text)]"
            >
              {mdPreview ? "Source" : "Preview"}
            </button>
          )}
          {parent && (
            <button
              onClick={() => onOpenPath(parent, "dir")}
              title="Open containing folder"
              className="rounded px-2 py-1 text-[var(--dh-text-secondary)] hover:bg-[var(--dh-surface-hover)] hover:text-[var(--dh-text)]"
            >
              Folder
            </button>
          )}
          <button
            onClick={() => onCopy(tab.content ?? "")}
            title="Copy contents"
            className="flex items-center gap-1 rounded px-2 py-1 text-[var(--dh-text-secondary)] hover:bg-[var(--dh-surface-hover)] hover:text-[var(--dh-text)]"
          >
            <Copy width={14} height={14} /> Copy
          </button>
          <a
            href={rawUrl}
            target="_blank"
            rel="noreferrer"
            title="Download"
            className="flex items-center gap-1 rounded px-2 py-1 text-[var(--dh-text-secondary)] hover:bg-[var(--dh-surface-hover)] hover:text-[var(--dh-text)]"
          >
            <Download width={14} height={14} /> Raw
          </a>
          <a
            href={`${meta.htmlUrl}/blob/${meta.branch}/${tab.path}`}
            target="_blank"
            rel="noreferrer"
            title="Open on GitHub"
            className="flex items-center gap-1 rounded px-2 py-1 text-[var(--dh-text-secondary)] hover:bg-[var(--dh-surface-hover)] hover:text-[var(--dh-text)]"
          >
            <ExternalLink width={14} height={14} /> GitHub
          </a>
        </div>
      </div>

      {isHistorical && (
        <div className="border-b border-violet-200 dark:border-violet-900/50 bg-violet-50 dark:bg-violet-950/30 px-3 py-2 text-sm text-violet-700 dark:text-violet-200">
          Viewing {tab.path.split("/").pop()} as of {tab.refLabel ?? "an older commit"} — historical
          commits can&apos;t be edited directly. Branch off a new variant to continue from here.
        </div>
      )}

      {historyOpen && (
        <FileHistoryPanel
          history={history}
          error={historyError}
          onSelect={(entry) => {
            openFileAtRef(tab.path, entry.sha, `${entry.sha.slice(0, 7)} · ${formatHistoryDate(entry.date)}`);
            setHistoryOpen(false);
          }}
          onClose={() => setHistoryOpen(false)}
        />
      )}

      {branchPrompt && (
        <BranchOffDialog
          defaultName={`variant/${branchPrompt.sha.slice(0, 7)}`}
          onCancel={() => setBranchPrompt(null)}
          onCreate={branchOff}
        />
      )}

      {lfsPointer && (
        <div className="border-b border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-950/30 px-3 py-2 text-sm text-blue-700 dark:text-blue-200">
          Git LFS pointer detected · {formatBytes(lfsPointer.size)} · {lfsProgress ?? "not downloaded"}
          <button
            className="ml-3 rounded bg-[var(--dh-accent)] px-2 py-1 text-xs text-[var(--dh-accent-foreground)]"
            onClick={async () => {
              const blob = await downloadLfsObject(meta.owner, meta.repo, lfsPointer, (loaded, total) => setLfsProgress(`${formatBytes(loaded)} / ${formatBytes(total)}`));
              const url = URL.createObjectURL(blob);
              window.open(url, "_blank", "noreferrer");
            }}
          >Download object</button>
        </div>
      )}
      {conflictHunks.length > 0 && (
        <div className="border-b border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-sm text-amber-700 dark:text-amber-200">
          {conflictHunks.length} merge conflict hunk{conflictHunks.length === 1 ? "" : "s"} detected. Edit the file, resolve markers, then save as a changeset delta.
        </div>
      )}
      {editing && (
        <div className="flex items-center gap-2 border-b border-[var(--dh-window-border)] bg-[var(--dh-surface)] px-3 py-2 text-xs text-[var(--dh-text-secondary)]">
          {savedFlash ? (
            <span className="text-emerald-700 dark:text-emerald-400">Saved as Working Change — checkpoint when ready.</span>
          ) : dirty ? (
            <span className="text-amber-700 dark:text-amber-400">Unsaved draft — kept across tab switches and reloads.</span>
          ) : (
            <span>Saving stages a Working Changes delta, not an immediate commit.</span>
          )}
          {isMarkdown && (
            <button
              onClick={() => setEditPreview((v) => !v)}
              className="ml-auto rounded bg-[var(--dh-surface-hover)] px-2 py-1 hover:bg-[var(--dh-surface-selected)]"
            >
              {editPreview ? "Editor" : "Preview"}
            </button>
          )}
          <button
            onClick={save}
            disabled={!dirty}
            title="Save (Ctrl/Cmd+S)"
            className={[
              isMarkdown ? "" : "ml-auto",
              "rounded bg-[var(--dh-accent)] px-2 py-1 text-[var(--dh-accent-foreground)] disabled:opacity-40",
            ].join(" ")}
          >
            Save <kbd className="ml-1 rounded bg-blue-800 px-1 text-[10px]">⌘S</kbd>
          </button>
          <button
            onClick={() => {
              discardEditorDraft(repoKey, tab.path);
              setDirty(false);
              setResetNonce((n) => n + 1);
            }}
            disabled={!dirty}
            className="rounded bg-[var(--dh-surface-hover)] px-2 py-1 disabled:opacity-40"
          >
            Discard draft
          </button>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-auto">
        {editing && needsSizeGuard ? (
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            <p className="text-sm text-[var(--dh-text-secondary)]">
              This file is {formatBytes(contentBytes)} — large files can make the
              editor slow.
            </p>
            <button
              onClick={() => setSizeGuardAccepted(true)}
              className="rounded-md bg-[var(--dh-accent)] px-4 py-1.5 text-sm font-medium text-[var(--dh-accent-foreground)] hover:opacity-90"
            >
              Edit anyway
            </button>
          </div>
        ) : editing && session ? (
          editPreview && isMarkdown ? (
            <div className="text-sm">{renderMarkdown(getEditorSession(repoKey, tab.path)?.draft ?? "")}</div>
          ) : (
            <CodeEditor
              key={`${tab.path}:${resetNonce}`}
              path={tab.path}
              initialValue={session.draft}
              initialViewState={
                session.selection
                  ? { selection: session.selection, scrollTop: session.scrollTop ?? 0 }
                  : undefined
              }
              onChange={(value, selection) => {
                updateEditorDraft(repoKey, tab.path, value, selection);
                setDirty(isSessionDirty(repoKey, tab.path));
              }}
              onSave={save}
              onViewState={(vs) =>
                saveEditorViewState(repoKey, tab.path, vs.selection, vs.scrollTop)
              }
            />
          )
        ) : isMarkdown && mdPreview && tab.content !== undefined ? (
          <div className="text-sm">{renderMarkdown(tab.content)}</div>
        ) : isImage ? (
          <ImageViewer
            owner={meta.owner}
            repo={meta.repo}
            branch={meta.branch}
            path={tab.path}
          />
        ) : (
          <pre className="flex min-w-full font-mono text-[12.5px] leading-5">
            <code className="flex min-w-full">
              <span className="select-none border-r border-[var(--dh-window-border)] px-3 py-2 text-right text-[var(--dh-text-disabled)]">
                {shownLines.map((_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
              </span>
              <span className="flex-1 px-4 py-2">
                {shownLines.map((line, i) => (
                  <div key={i} className="whitespace-pre">
                    {line.length === 0 ? (
                      " "
                    ) : (
                      line.map((tok, j) => (
                        <span key={j} className={TOKEN_CLASS[tok.type]}>
                          {tok.text}
                        </span>
                      ))
                    )}
                  </div>
                ))}
              </span>
            </code>
          </pre>
        )}
        {truncated && (
          <div className="border-t border-[var(--dh-window-border)] bg-[var(--dh-surface)] px-4 py-2 text-[12px] text-[var(--dh-text-secondary)]">
            Showing first {CAP} lines of {lines.length.toLocaleString()}. Use
            “Raw” to view the full file.
          </div>
        )}
      </div>
    </div>
  );
}

function formatHistoryDate(iso: string): string {
  if (!iso) return "unknown date";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/** Lists commits that touched the active file, newest first — the entry
 * point into viewing (and, from there, branching off) a historical ref. */
function FileHistoryPanel({
  history,
  error,
  onSelect,
  onClose,
}: {
  history: FileHistoryEntry[] | null;
  error: string | null;
  onSelect: (entry: FileHistoryEntry) => void;
  onClose: () => void;
}) {
  return (
    <div className="max-h-64 overflow-auto border-b border-[var(--dh-window-border)] bg-[var(--dh-surface)]">
      <div className="flex items-center justify-between px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-[var(--dh-text-secondary)]">
        File history
        <button
          onClick={onClose}
          className="rounded px-1.5 py-0.5 normal-case text-[var(--dh-text-secondary)] hover:bg-[var(--dh-surface-hover)]"
        >
          Close
        </button>
      </div>
      {error && <p className="px-3 pb-2 text-sm text-red-600 dark:text-red-300">{error}</p>}
      {!error && !history && (
        <div className="flex items-center gap-2 px-3 pb-2 text-sm text-[var(--dh-text-secondary)]">
          <Spinner width={14} height={14} className="text-blue-700 dark:text-blue-400" /> Loading history…
        </div>
      )}
      {history && history.length === 0 && (
        <p className="px-3 pb-2 text-sm text-[var(--dh-text-disabled)]">No commit history found for this file.</p>
      )}
      {history && history.length > 0 && (
        <ul>
          {history.map((entry) => (
            <li key={entry.sha}>
              <button
                onClick={() => onSelect(entry)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-[var(--dh-surface-hover)]"
              >
                <span className="shrink-0 rounded bg-[var(--dh-surface-hover)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--dh-text-secondary)]">
                  {entry.sha.slice(0, 7)}
                </span>
                <span className="min-w-0 flex-1 truncate text-[var(--dh-text)]">{entry.message}</span>
                <span className="shrink-0 text-[11px] text-[var(--dh-text-secondary)]">
                  {entry.author} · {formatHistoryDate(entry.date)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Prompts for a new branch name and creates it from the historical commit
 * being viewed (M3 acceptance criterion: "branch off a new variant" instead
 * of a blocking error when editing a non-tip ref). */
function BranchOffDialog({
  defaultName,
  onCancel,
  onCreate,
}: {
  defaultName: string;
  onCancel: () => void;
  onCreate: (branchName: string) => Promise<void>;
}) {
  const [name, setName] = useState(defaultName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Branch name is required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onCreate(trimmed);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create branch.");
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-lg border border-[var(--dh-window-border)] bg-[var(--dh-surface-raised)] p-4 shadow-2xl">
        <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-[var(--dh-text)]">
          <BranchIcon width={15} height={15} /> Branch off to edit
        </h3>
        <p className="mb-3 text-xs text-[var(--dh-text-secondary)]">
          Creates a new branch starting at this exact commit, then opens it here for editing.
        </p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void submit();
          }}
          autoFocus
          spellCheck={false}
          className="w-full rounded border border-[var(--dh-window-border)] bg-[var(--dh-surface)] px-2 py-1.5 text-sm text-[var(--dh-text)] outline-none focus:border-[var(--dh-window-border-active)]"
        />
        {error && <p className="mt-2 text-xs text-red-600 dark:text-red-300">{error}</p>}
        <div className="mt-3 flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={busy}
            className="rounded px-3 py-1.5 text-sm text-[var(--dh-text-secondary)] hover:bg-[var(--dh-surface-hover)] disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={() => void submit()}
            disabled={busy}
            className="rounded bg-[var(--dh-accent)] px-3 py-1.5 text-sm font-medium text-[var(--dh-accent-foreground)] hover:opacity-90 disabled:opacity-40"
          >
            {busy ? "Creating…" : "Create & edit"}
          </button>
        </div>
      </div>
    </div>
  );
}
