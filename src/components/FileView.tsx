"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { useUI } from "./ui-context";
import type { MenuItem } from "./ContextMenu";
import { GH_NODE_MIME, type GhNodeDrag } from "@/lib/dnd";
import { useChanges } from "@/features/changes";
import { CodeEditor } from "./CodeEditor";
import {
  ChevronRight,
  Cloud,
  CloudDownload,
  Copy,
  Download,
  Edit,
  ExternalLink,
  FileIcon,
  FileImage,
  FileText,
  FolderOpen,
  Refresh,
  Spinner,
  X,
} from "./icons";
import { formatBytes, type GithubEntry } from "@/lib/github";
import { tokenizeLines } from "@/lib/highlight";
import { parseLfsPointer, downloadLfsObject, type LfsPointer } from "@/lib/lfs";
import { fetchVitality, formatRelativeDays, isStale } from "@/lib/vitality";
import { CELL, loadLayout, saveLayout, snap, autoPlace, type LayoutMap } from "@/lib/layout";

const IMAGE_EXT = ["png", "jpg", "jpeg", "gif", "svg", "webp", "ico", "bmp", "avif"];

function fileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (IMAGE_EXT.includes(ext))
    return <FileImage width={16} height={16} className="shrink-0 text-pink-400" />;
  if (["md", "txt", "mdx", "rst"].includes(ext))
    return <FileText width={16} height={16} className="shrink-0 text-neutral-400" />;
  return <FileIcon width={16} height={16} className="shrink-0 text-sky-400" />;
}

const TOKEN_CLASS: Record<string, string> = {
  comment: "text-neutral-500 italic",
  string: "text-emerald-400",
  number: "text-amber-300",
  keyword: "text-violet-400",
  ident: "text-neutral-200",
  ws: "text-neutral-200",
  punct: "text-neutral-400",
  plain: "text-neutral-200",
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
    invalidateDir,
    setViewMode,
  } = useStore();
  const { openMenu } = useUI();

  const activeTab =
    state.tabs.find((t) => t.id === state.activeTabId) ?? null;
  const meta = state.meta;
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
      <div className="flex h-full items-center justify-center text-neutral-600">
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
          invalidateDir(node.path);
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
    if (!state.selection.includes(node.path)) {
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
      const next = state.selection.includes(node.path)
        ? state.selection.filter((p) => p !== node.path)
        : [...state.selection, node.path];
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
    <div className="flex h-full flex-col bg-neutral-900">
      <div className="flex items-center gap-1 border-b border-neutral-800 bg-neutral-950 px-3 py-2 text-[13px]">
        {breadcrumbs.map((b, i) => (
          <span key={b.path} className="flex items-center gap-1">
            {i > 0 && (
              <ChevronRight width={14} height={14} className="text-neutral-600" />
            )}
            <button
              onClick={() => openPath(b.path, "dir")}
              className={[
                "rounded px-1.5 py-0.5 hover:bg-neutral-800",
                i === breadcrumbs.length - 1
                  ? "font-semibold text-neutral-100"
                  : "text-blue-400",
              ].join(" ")}
            >
              {b.name}
            </button>
          </span>
        ))}
        {activeTab.kind === "dir" && (
          <div className="ml-auto flex items-center gap-0.5 rounded-md border border-neutral-800 p-0.5">
            <button
              onClick={() => setViewMode("list")}
              title="List view"
              className={[
                "rounded px-2 py-1 text-[12px]",
                state.viewMode === "list"
                  ? "bg-neutral-800 text-neutral-100"
                  : "text-neutral-500 hover:text-neutral-200",
              ].join(" ")}
            >
              List
            </button>
            <button
              onClick={() => setViewMode("grid")}
              title="Grid view"
              className={[
                "rounded px-2 py-1 text-[12px]",
                state.viewMode === "grid"
                  ? "bg-neutral-800 text-neutral-100"
                  : "text-neutral-500 hover:text-neutral-200",
              ].join(" ")}
            >
              Grid
            </button>
          </div>
        )}
      </div>

      {activeTab.kind === "dir" ? (
        state.viewMode === "grid" ? (
          <GridView
            tab={activeTab}
            onOpenPath={openPath}
            onOpenNew={openInNewTab}
            onSelect={select}
            onContextMenu={onContextMenu}
            selection={state.selection}
            meta={meta}
            repoKey={meta.fullName}
            branch={meta.branch}
          />
        ) : (
          <FolderView
            tab={activeTab}
            onOpenPath={openPath}
            onOpenNew={openInNewTab}
            onSelect={select}
            onContextMenu={onContextMenu}
            modifiers={modifiers}
            selection={state.selection}
            meta={meta}
          />
        )
      ) : (
        <FileContentView
          key={activeTab.id}
          tab={activeTab}
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

function GridView({
  tab,
  onOpenPath,
  onOpenNew,
  onSelect,
  onContextMenu,
  selection,
  repoKey,
  branch,
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
  selection: string[];
  meta: { owner: string; repo: string; branch: string };
  repoKey: string;
  branch: string;
}) {
  const entries = useMemo(() => tab.entries ?? [], [tab.entries]);
  const [layout, setLayoutState] = useState<LayoutMap>({});
  const [ready, setReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{
    name: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);
  const [dragPos, setDragPos] = useState<{ name: string; x: number; y: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    void loadLayout(repoKey, branch, tab.path).then((map) => {
      if (cancelled) return;
      const columns = Math.max(1, Math.floor((containerRef.current?.clientWidth ?? 640) / CELL));
      const placed = autoPlace(
        map,
        entries.map((e) => e.name),
        columns
      );
      setLayoutState(placed);
      setReady(true);
      if (Object.keys(placed).length !== Object.keys(map).length) {
        void saveLayout(repoKey, branch, tab.path, placed);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [repoKey, branch, tab.path, entries]);

  function startDrag(e: React.PointerEvent<HTMLDivElement>, name: string) {
    e.currentTarget.setPointerCapture(e.pointerId);
    const pos = layout[name] ?? { x: 0, y: 0 };
    dragState.current = { name, startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };
    setDragPos({ name, x: pos.x, y: pos.y });
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = dragState.current;
    if (!d) return;
    setDragPos({ name: d.name, x: d.origX + (e.clientX - d.startX), y: d.origY + (e.clientY - d.startY) });
  }
  function endDrag() {
    const d = dragState.current;
    if (!d || !dragPos) {
      dragState.current = null;
      return;
    }
    const snapped = snap(dragPos.x, dragPos.y);
    const next = { ...layout, [d.name]: snapped };
    setLayoutState(next);
    setDragPos(null);
    dragState.current = null;
    void saveLayout(repoKey, branch, tab.path, next);
  }

  const modifiers = (e: React.MouseEvent): "none" | "ctrl" | "shift" => {
    if (e.metaKey || e.ctrlKey) return "ctrl";
    if (e.shiftKey) return "shift";
    return "none";
  };

  if (tab.entriesState === "loading" && entries.length === 0) {
    return (
      <div className="flex items-center gap-2 p-4 text-neutral-500">
        <Spinner width={15} height={15} className="text-blue-400" />
        Loading…
      </div>
    );
  }
  if (tab.entriesState === "error") {
    return <div className="p-4 text-red-400">Failed to load folder.</div>;
  }

  const maxY =
    Math.max(0, ...entries.map((e) => (layout[e.name]?.y ?? 0) + CELL)) + CELL;

  return (
    <div
      ref={containerRef}
      className="relative flex-1 overflow-auto"
      style={{ minHeight: Math.max(maxY, 200) }}
    >
      {ready &&
        entries.map((e) => {
          const pos =
            dragPos && dragPos.name === e.name ? dragPos : (layout[e.name] ?? { x: 0, y: 0 });
          const selected = selection.includes(e.path);
          return (
            <div
              key={e.path}
              onPointerDown={(ev) => startDrag(ev, e.name)}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onClick={(ev) => onSelect(e, entries, modifiers(ev))}
              onDoubleClick={() => onOpenPath(e.path, e.type)}
              onAuxClick={(ev) => {
                if (ev.button === 1) {
                  ev.preventDefault();
                  onOpenNew(e.path, e.type);
                }
              }}
              onContextMenu={(ev) => onContextMenu(ev, e)}
              className={[
                "absolute flex cursor-grab select-none flex-col items-center gap-1 rounded-md p-2 text-center",
                selected ? "bg-blue-600/20 ring-1 ring-blue-500" : "hover:bg-neutral-800/60",
              ].join(" ")}
              style={{ left: pos.x, top: pos.y, width: CELL - 8 }}
            >
              {e.type === "dir" ? (
                <FolderOpen width={28} height={28} className="shrink-0 text-amber-400" />
              ) : (
                <span className="[&>svg]:h-7 [&>svg]:w-7">{fileIcon(e.name)}</span>
              )}
              <span className="w-full truncate text-[11px] text-neutral-300">{e.name}</span>
            </div>
          );
        })}
      {entries.length === 0 && (
        <div className="p-8 text-center text-neutral-600">Empty folder</div>
      )}
    </div>
  );
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
  meta: { owner: string; repo: string; branch: string };
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
      <div className="flex items-center gap-2 p-4 text-neutral-500">
        <Spinner width={15} height={15} className="text-blue-400" />
        Loading…
      </div>
    );
  }
  if (tab.entriesState === "error") {
    return <div className="p-4 text-red-400">Failed to load folder.</div>;
  }

  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="sticky top-0 z-10 border-b border-neutral-800 bg-neutral-950 text-left text-[11px] uppercase tracking-wider text-neutral-500">
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
                  "cursor-pointer border-b border-neutral-800/50 hover:bg-neutral-800/50",
                  selected ? "bg-blue-600/20" : "",
                ].join(" ")}
              >
                <td className="px-3 py-1.5">
                  <div className="flex items-center gap-2 text-neutral-200">
                    {e.type === "dir" ? (
                      <FolderOpen
                        width={16}
                        height={16}
                        className="shrink-0 text-amber-400"
                      />
                    ) : (
                      fileIcon(e.name)
                    )}
                    <span className="truncate">{e.name}</span>
                  </div>
                </td>
                <td className="px-3 py-1.5 text-neutral-400">
                  {e.type === "dir" ? "—" : formatBytes(e.size)}
                </td>
                <td className="hidden px-3 py-1.5 text-neutral-500 sm:table-cell">
                  {e.type === "dir" ? "Folder" : e.name.split(".").pop()?.toUpperCase() || "File"}
                </td>
              </tr>
            );
          })}
          {entries.length === 0 && (
            <tr>
              <td colSpan={3} className="px-3 py-8 text-center text-neutral-600">
                Empty folder
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function FileContentView({
  tab,
  meta,
  onOpenPath,
  onCopy,
}: {
  tab: {
    path: string;
    content?: string;
    contentState: string;
    contentError?: string;
    language?: string;
    size?: number;
  };
  meta: { owner: string; repo: string; branch: string; htmlUrl: string };
  onOpenPath: (p: string, k: "file" | "dir") => void;
  onCopy: (t: string) => void;
}) {
  const { changes, stageEdit, loadPendingContent } = useChanges();
  const isImage = IMAGE_EXT.includes(
    tab.path.split(".").pop()?.toLowerCase() ?? ""
  );
  const parent = tab.path.includes("/")
    ? tab.path.slice(0, tab.path.lastIndexOf("/"))
    : "";

  const pending = changes.find(
    (c) => (c.kind === "add" || c.kind === "modify") && c.path === tab.path
  );
  const [pendingText, setPendingText] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (pending?.blobId) {
      void loadPendingContent(tab.path).then((data) => {
        if (cancelled || !data) return;
        setPendingText(new TextDecoder("utf-8", { fatal: false }).decode(data));
      });
    } else {
      setPendingText(null);
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending?.blobId, tab.path]);

  const effectiveContent = pending ? pendingText : tab.content;

  // A pending add/modify is always literal new content, never a real LFS
  // pointer fetched from GitHub — only check the remote-loaded case.
  const lfsPointer = !pending && tab.content ? parseLfsPointer(tab.content) : null;

  const [vitality, setVitality] = useState<{ date: string } | null | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    setVitality(undefined);
    fetchVitality(meta.owner, meta.repo, meta.branch, tab.path)
      .then((info) => {
        if (!cancelled) setVitality(info ? { date: info.date } : null);
      })
      .catch(() => {
        if (!cancelled) setVitality(null);
      });
    return () => {
      cancelled = true;
    };
  }, [meta.owner, meta.repo, meta.branch, tab.path]);

  const [lfsState, setLfsState] = useState<
    { status: "idle" } | { status: "downloading"; loaded: number; total: number } | { status: "done"; url: string; bytes: number } | { status: "error"; error: string }
  >({ status: "idle" });

  useEffect(() => {
    return () => {
      if (lfsState.status === "done") URL.revokeObjectURL(lfsState.url);
    };
  }, [lfsState]);

  async function downloadLfs(pointer: LfsPointer) {
    setLfsState({ status: "downloading", loaded: 0, total: pointer.size });
    try {
      const bytes = await downloadLfsObject(meta.owner, meta.repo, pointer, (loaded, total) =>
        setLfsState({ status: "downloading", loaded, total })
      );
      const blob = new Blob([bytes as BlobPart]);
      const url = URL.createObjectURL(blob);
      setLfsState({ status: "done", url, bytes: bytes.byteLength });
    } catch (err) {
      setLfsState({
        status: "error",
        error: err instanceof Error ? err.message : "LFS download failed.",
      });
    }
  }

  const lines = useMemo(
    () => (effectiveContent && !lfsPointer ? tokenizeLines(effectiveContent) : []),
    [effectiveContent, lfsPointer]
  );

  const CAP = 4000;
  const truncated = lines.length > CAP;
  const shownLines = truncated ? lines.slice(0, CAP) : lines;

  const isNewPending = !!pending;
  const stillLoadingRemote = !isNewPending && tab.contentState === "loading";
  const stillLoadingPending = isNewPending && pendingText === null && !!pending?.blobId;

  if (stillLoadingRemote || stillLoadingPending) {
    return (
      <div className="flex items-center gap-2 p-4 text-neutral-500">
        <Spinner width={15} height={15} className="text-blue-400" />
        Loading {tab.path.split("/").pop()}…
      </div>
    );
  }
  if (!isNewPending && tab.contentState === "error") {
    return (
      <div className="p-4 text-red-400">
        {tab.contentError ?? "Failed to load file."}
      </div>
    );
  }

  const rawUrl = `https://raw.githubusercontent.com/${meta.owner}/${meta.repo}/${meta.branch}/${tab.path}`;

  function startEditing() {
    setDraft(effectiveContent ?? "");
    setEditing(true);
  }

  async function save() {
    setSaving(true);
    try {
      await stageEdit(tab.path, new TextEncoder().encode(draft));
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-neutral-800 bg-neutral-950 px-3 py-1.5 text-[13px]">
        {fileIcon(tab.path.split("/").pop() ?? "")}
        <span className="font-medium text-neutral-100">
          {tab.path.split("/").pop()}
        </span>
        {tab.language && (
          <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[11px] text-neutral-300">
            {tab.language}
          </span>
        )}
        {pending?.kind === "add" && (
          <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[11px] font-medium text-emerald-400">
            new — pending checkpoint
          </span>
        )}
        {pending?.kind === "modify" && (
          <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[11px] font-medium text-amber-400">
            modified — pending checkpoint
          </span>
        )}
        {typeof tab.size === "number" && !pending && (
          <span className="text-[11px] text-neutral-500">
            {formatBytes(tab.size)}
          </span>
        )}
        {!pending && vitality && (
          <span
            className={[
              "text-[11px]",
              isStale(vitality.date) ? "text-amber-500" : "text-neutral-500",
            ].join(" ")}
            title={new Date(vitality.date).toLocaleString()}
          >
            {isStale(vitality.date) ? "stale — " : "changed "}
            {formatRelativeDays(vitality.date)}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          {editing ? (
            <>
              <button
                onClick={() => void save()}
                disabled={saving}
                title="Save (stages this as a working change)"
                className="flex items-center gap-1 rounded px-2 py-1 text-emerald-400 hover:bg-neutral-800 disabled:opacity-50"
              >
                {saving && <Spinner width={13} height={13} />}
                Save
              </button>
              <button
                onClick={() => setEditing(false)}
                title="Discard edits"
                className="flex items-center gap-1 rounded px-2 py-1 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
              >
                <X width={14} height={14} /> Cancel
              </button>
            </>
          ) : (
            !isImage &&
            !lfsPointer && (
              <button
                onClick={startEditing}
                title="Edit"
                className="flex items-center gap-1 rounded px-2 py-1 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
              >
                <Edit width={14} height={14} /> Edit
              </button>
            )
          )}
          {parent && (
            <button
              onClick={() => onOpenPath(parent, "dir")}
              title="Open containing folder"
              className="rounded px-2 py-1 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
            >
              Folder
            </button>
          )}
          {!lfsPointer && (
            <button
              onClick={() => onCopy(effectiveContent ?? "")}
              title="Copy contents"
              className="flex items-center gap-1 rounded px-2 py-1 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
            >
              <Copy width={14} height={14} /> Copy
            </button>
          )}
          {!isNewPending && !lfsPointer && (
            <a
              href={rawUrl}
              target="_blank"
              rel="noreferrer"
              title="Download"
              className="flex items-center gap-1 rounded px-2 py-1 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
            >
              <Download width={14} height={14} /> Raw
            </a>
          )}
          <a
            href={`${meta.htmlUrl}/blob/${meta.branch}/${tab.path}`}
            target="_blank"
            rel="noreferrer"
            title="Open on GitHub"
            className="flex items-center gap-1 rounded px-2 py-1 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
          >
            <ExternalLink width={14} height={14} /> GitHub
          </a>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {lfsPointer ? (
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            <Cloud width={40} height={40} className="text-sky-400" />
            <div className="text-sm text-neutral-200">
              Stored in Git LFS — {formatBytes(lfsPointer.size)}
            </div>
            <div className="text-xs text-neutral-500">
              Not downloaded automatically. Fetch the real content on demand.
            </div>
            {lfsState.status === "idle" && (
              <button
                onClick={() => void downloadLfs(lfsPointer)}
                className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
              >
                <CloudDownload width={16} height={16} /> Download
              </button>
            )}
            {lfsState.status === "downloading" && (
              <div className="w-64">
                <div className="h-2 overflow-hidden rounded-full bg-neutral-800">
                  <div
                    className="h-full bg-blue-500 transition-all"
                    style={{
                      width: `${lfsState.total ? Math.min(100, (lfsState.loaded / lfsState.total) * 100) : 0}%`,
                    }}
                  />
                </div>
                <div className="mt-1 text-xs text-neutral-500">
                  {formatBytes(lfsState.loaded)} / {formatBytes(lfsState.total)}
                </div>
              </div>
            )}
            {lfsState.status === "error" && (
              <div className="text-sm text-red-400">{lfsState.error}</div>
            )}
            {lfsState.status === "done" &&
              (isImage ? (
                <div className="flex flex-col items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={lfsState.url}
                    alt={tab.path.split("/").pop()}
                    className="max-h-96 max-w-full rounded-lg border border-neutral-800"
                  />
                  <a
                    href={lfsState.url}
                    download={tab.path.split("/").pop()}
                    className="flex items-center gap-1 text-sm text-blue-400 hover:underline"
                  >
                    <Download width={14} height={14} /> Save {formatBytes(lfsState.bytes)}
                  </a>
                </div>
              ) : (
                <a
                  href={lfsState.url}
                  download={tab.path.split("/").pop()}
                  className="flex items-center gap-2 rounded-md border border-neutral-700 px-4 py-2 text-sm text-neutral-200 hover:border-neutral-600"
                >
                  <Download width={14} height={14} /> Save {formatBytes(lfsState.bytes)}
                </a>
              ))}
          </div>
        ) : editing ? (
          <CodeEditor path={tab.path} initialValue={draft} onChange={setDraft} />
        ) : isImage ? (
          <div className="flex justify-center p-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={rawUrl}
              alt={tab.path.split("/").pop()}
              className="max-h-full max-w-full rounded-lg border border-neutral-800"
            />
          </div>
        ) : (
          <pre className="flex min-w-full font-mono text-[12.5px] leading-5">
            <code className="flex min-w-full">
              <span className="select-none border-r border-neutral-800 px-3 py-2 text-right text-neutral-600">
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
        {!editing && truncated && (
          <div className="border-t border-neutral-800 bg-neutral-950 px-4 py-2 text-[12px] text-neutral-500">
            Showing first {CAP} lines of {lines.length.toLocaleString()}. Use
            “Raw” to view the full file.
          </div>
        )}
      </div>
    </div>
  );
}
