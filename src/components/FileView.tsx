"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useActiveRepo, useStore } from "@/lib/store";
import { useUI } from "./ui-context";
import type { MenuItem } from "./ContextMenu";
import { GH_NODE_MIME, type GhNodeDrag } from "@/lib/dnd";
import {
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  FileIcon,
  FileImage,
  FileText,
  FolderOpen,
  Refresh,
  Spinner,
} from "./icons";
import { formatBytes, type GithubEntry } from "@/lib/github";
import { parseLfsPointer, downloadLfsObject } from "@/lib/lfs";
import { parseConflictHunks } from "@/lib/merge";
import { useChanges } from "@/features/changes";
import { tokenizeLines } from "@/lib/highlight";

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
      <div className="flex items-center gap-2 p-4 text-neutral-500">
        <Spinner width={15} height={15} className="text-blue-400" />
        Loading…
      </div>
    );
  }
  if (tab.entriesState === "error") {
    return <div className="p-4 text-red-400">Failed to load folder.</div>;
  }

  if (viewMode === "grid") {
    return (
      <div className="flex-1 overflow-auto p-3">
        <div className="mb-3 flex justify-end gap-1 text-xs"><button onClick={() => onViewMode("list")} className="rounded bg-neutral-800 px-2 py-1 text-neutral-300">List</button><button onClick={() => onViewMode("grid")} className="rounded bg-blue-600 px-2 py-1 text-white">Grid</button></div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-3">
          {entries.map((e) => { const selected = selection.includes(e.path); return (
            <button key={e.path} draggable onDragStart={(ev) => { const payload: GhNodeDrag = { path: e.path, kind: e.type }; ev.dataTransfer.setData(GH_NODE_MIME, JSON.stringify(payload)); }} onClick={(ev) => onSelect(e, entries, modifiers(ev))} onDoubleClick={() => onOpenPath(e.path, e.type)} onContextMenu={(ev) => onContextMenu(ev, e)} className={["flex h-28 flex-col items-center justify-center gap-2 rounded-lg border p-2 text-center hover:bg-neutral-800", selected ? "border-blue-500 bg-blue-600/20" : "border-neutral-800 bg-neutral-900"].join(" ")}>
              {e.type === "dir" ? <FolderOpen width={28} height={28} className="text-amber-400" /> : fileIcon(e.name)}
              <span className="line-clamp-2 text-xs text-neutral-200">{e.name}</span>
              <span className="text-[10px] text-neutral-500">{e.type === "dir" ? "Folder" : formatBytes(e.size)}</span>
            </button> ); })}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="sticky top-0 z-20 flex justify-end gap-1 border-b border-neutral-800 bg-neutral-950 px-3 py-2 text-xs"><button onClick={() => onViewMode("list")} className="rounded bg-blue-600 px-2 py-1 text-white">List</button><button onClick={() => onViewMode("grid")} className="rounded bg-neutral-800 px-2 py-1 text-neutral-300">Grid</button></div>
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
  const isImage = IMAGE_EXT.includes(
    tab.path.split(".").pop()?.toLowerCase() ?? ""
  );
  const parent = tab.path.includes("/")
    ? tab.path.slice(0, tab.path.lastIndexOf("/"))
    : "";
  const { stageAddFile } = useChanges();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(tab.content ?? "");
  const [lfsProgress, setLfsProgress] = useState<string | null>(null);
  const lfsPointer = parseLfsPointer(tab.content);
  const conflictHunks = useMemo(() => parseConflictHunks(tab.content ?? ""), [tab.content]);

  useEffect(() => setDraft(tab.content ?? ""), [tab.content, tab.path]);

  const lines = useMemo(
    () => (tab.content ? tokenizeLines(tab.content) : []),
    [tab.content]
  );

  const CAP = 4000;
  const truncated = lines.length > CAP;
  const shownLines = truncated ? lines.slice(0, CAP) : lines;

  if (tab.contentState === "loading") {
    return (
      <div className="flex items-center gap-2 p-4 text-neutral-500">
        <Spinner width={15} height={15} className="text-blue-400" />
        Loading {tab.path.split("/").pop()}…
      </div>
    );
  }
  if (tab.contentState === "error") {
    return (
      <div className="p-4 text-red-400">
        {tab.contentError ?? "Failed to load file."}
      </div>
    );
  }

  const rawUrl = `https://raw.githubusercontent.com/${meta.owner}/${meta.repo}/${meta.branch}/${tab.path}`;

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
        {typeof tab.size === "number" && (
          <span className="text-[11px] text-neutral-500">
            {formatBytes(tab.size)}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          {!isImage && !lfsPointer && (
            <button
              onClick={() => setEditing((v) => !v)}
              className="rounded px-2 py-1 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
            >
              {editing ? "Preview" : "Edit"}
            </button>
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
          <button
            onClick={() => onCopy(tab.content ?? "")}
            title="Copy contents"
            className="flex items-center gap-1 rounded px-2 py-1 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
          >
            <Copy width={14} height={14} /> Copy
          </button>
          <a
            href={rawUrl}
            target="_blank"
            rel="noreferrer"
            title="Download"
            className="flex items-center gap-1 rounded px-2 py-1 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
          >
            <Download width={14} height={14} /> Raw
          </a>
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

      {lfsPointer && (
        <div className="border-b border-blue-900/50 bg-blue-950/30 px-3 py-2 text-sm text-blue-200">
          Git LFS pointer detected · {formatBytes(lfsPointer.size)} · {lfsProgress ?? "not downloaded"}
          <button
            className="ml-3 rounded bg-blue-600 px-2 py-1 text-xs text-white"
            onClick={async () => {
              const blob = await downloadLfsObject(meta.owner, meta.repo, lfsPointer, (loaded, total) => setLfsProgress(`${formatBytes(loaded)} / ${formatBytes(total)}`));
              const url = URL.createObjectURL(blob);
              window.open(url, "_blank", "noreferrer");
            }}
          >Download object</button>
        </div>
      )}
      {conflictHunks.length > 0 && (
        <div className="border-b border-amber-900/50 bg-amber-950/30 px-3 py-2 text-sm text-amber-200">
          {conflictHunks.length} merge conflict hunk{conflictHunks.length === 1 ? "" : "s"} detected. Edit the file, resolve markers, then save as a changeset delta.
        </div>
      )}
      {editing && (
        <div className="flex items-center gap-2 border-b border-neutral-800 bg-neutral-950 px-3 py-2 text-xs text-neutral-300">
          Saving creates a pending Working Changes delta, not an immediate commit.
          <button onClick={() => void stageAddFile(tab.path, new TextEncoder().encode(draft), "manual")} className="ml-auto rounded bg-blue-600 px-2 py-1 text-white">Save delta</button>
          <button onClick={() => setDraft(tab.content ?? "")} className="rounded bg-neutral-800 px-2 py-1">Reset</button>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-auto">
        {editing ? (
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} spellCheck={false} className="min-h-full w-full resize-none bg-neutral-950 p-4 font-mono text-[12.5px] leading-5 text-neutral-100 outline-none" />
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
        {truncated && (
          <div className="border-t border-neutral-800 bg-neutral-950 px-4 py-2 text-[12px] text-neutral-500">
            Showing first {CAP} lines of {lines.length.toLocaleString()}. Use
            “Raw” to view the full file.
          </div>
        )}
      </div>
    </div>
  );
}
