"use client";

import { useRef } from "react";
import { useStore } from "@/lib/store";
import { useUI } from "./ui-context";
import type { MenuItem } from "./ContextMenu";
import { GH_NODE_MIME, type GhNodeDrag } from "@/lib/dnd";
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  FileIcon,
  FileImage,
  FileText,
  Folder,
  FolderOpen,
  Refresh,
  Spinner,
} from "./icons";
import type { GithubEntry } from "@/lib/github";

function fileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (["png", "jpg", "jpeg", "gif", "svg", "webp", "ico", "bmp"].includes(ext))
    return <FileImage width={15} height={15} className="shrink-0 text-pink-400" />;
  if (["md", "txt", "mdx", "rst"].includes(ext))
    return <FileText width={15} height={15} className="shrink-0 text-neutral-400" />;
  return <FileIcon width={15} height={15} className="shrink-0 text-sky-400" />;
}

export function Explorer() {
  const { state, toggleExpand, ensureDir, openPath, openInNewTab, setSelection } =
    useStore();
  const { openMenu } = useUI();
  const anchor = useRef<string | null>(null);

  if (!state.meta) return null;

  const meta = state.meta;
  const rootEntries = state.treeCache[""] ?? [];
  const rootState = state.treeState[""] ?? "loading";

  function copy(text: string) {
    navigator.clipboard?.writeText(text).catch(() => {});
  }

  function nodeMenuItems(node: GithubEntry): MenuItem[] {
    const fullPath = node.path;
    const ghUrl = `${meta.htmlUrl}/${node.type === "dir" ? "tree" : "blob"}/${meta.branch}/${fullPath}`;
    const items: MenuItem[] = [
      {
        id: "open",
        label: "Open",
        shortcut: "↵",
        onClick: () => openPath(fullPath, node.type),
      },
      {
        id: "open-new",
        label: "Open in New Tab",
        shortcut: "⌘/Ctrl+↵",
        onClick: () => openInNewTab(fullPath, node.type),
      },
    ];
    if (node.type === "dir") {
      items.push({
        id: "refresh",
        label: "Refresh",
        icon: <Refresh width={15} height={15} />,
        separatorBefore: true,
        onClick: () => {
          if (state.treeCache[fullPath]) deleteCached(fullPath);
          toggleExpand(fullPath, true);
        },
      });
    }
    items.push(
      {
        id: "copy-path",
        label: "Copy path",
        icon: <Copy width={15} height={15} />,
        separatorBefore: true,
        onClick: () => copy(fullPath),
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
            `https://raw.githubusercontent.com/${meta.owner}/${meta.repo}/${meta.branch}/${fullPath}`,
            "_blank",
            "noreferrer"
          ),
      });
    }
    return items;
  }

  function deleteCached(path: string) {
    // mutation is fine: reducer will overwrite on next load
    delete state.treeCache[path];
  }

  function multiMenuItems(): MenuItem[] {
    return [
      {
        id: "copy-paths",
        label: `Copy ${state.selection.length} paths`,
        icon: <Copy width={15} height={15} />,
        onClick: () => copy(state.selection.join("\n")),
      },
      {
        id: "gh-first",
        label: "Open first on GitHub",
        icon: <ExternalLink width={15} height={15} />,
        onClick: () =>
          window.open(
            `${meta.htmlUrl}/blob/${meta.branch}/${state.selection[0]}`,
            "_blank",
            "noreferrer"
          ),
      },
    ];
  }

  function onContextMenu(
    e: React.MouseEvent,
    node: GithubEntry,
    siblings: GithubEntry[]
  ) {
    e.preventDefault();
    e.stopPropagation();
    if (!state.selection.includes(node.path)) {
      setSelection([node.path]);
      anchor.current = node.path;
    }
    if (state.selection.length > 1) {
      openMenu(e.clientX, e.clientY, multiMenuItems());
    } else {
      openMenu(e.clientX, e.clientY, nodeMenuItems(node));
    }
  }

  function selectNode(
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
      const idxA = siblings.findIndex((s) => s.path === anchor.current);
      const idxB = siblings.findIndex((s) => s.path === node.path);
      if (idxA !== -1 && idxB !== -1) {
        const [lo, hi] = idxA < idxB ? [idxA, idxB] : [idxB, idxA];
        setSelection(siblings.slice(lo, hi + 1).map((s) => s.path));
        return;
      }
    }
    setSelection([node.path]);
    anchor.current = node.path;
  }

  return (
    <div className="flex h-full flex-col bg-neutral-950">
      <div className="flex items-center justify-between border-b border-neutral-800 px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
          Explorer
        </span>
        <button
          onClick={() => {
            if (state.treeCache[""]) deleteCached("");
            void ensureDir("");
          }}
          title="Refresh root"
          className="flex h-6 w-6 items-center justify-center rounded text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
        >
          <Refresh width={14} height={14} />
        </button>
      </div>

      <div className="flex-1 overflow-auto py-1 text-[13px]">
        {rootState === "loading" && rootEntries.length === 0 && (
          <div className="flex items-center gap-2 px-3 py-2 text-neutral-500">
            <Spinner width={14} height={14} className="text-blue-400" />
            Loading…
          </div>
        )}
        {rootState === "error" && (
          <div className="px-3 py-2 text-red-400">Failed to load folder.</div>
        )}
        {rootEntries.map((node) => (
          <TreeNode
            key={node.path}
            node={node}
            depth={0}
            siblings={rootEntries}
            onOpenPath={openPath}
            onOpenNew={openInNewTab}
            onToggle={toggleExpand}
            onContextMenu={onContextMenu}
            onSelect={selectNode}
            getEntries={(p) => state.treeCache[p] ?? []}
            getState={(p) => state.treeState[p] ?? "loading"}
            isExpanded={(p) => !!state.expanded[p]}
            isSelected={(p) => state.selection.includes(p)}
            activePath={
              state.tabs.find((t) => t.id === state.activeTabId)?.path ?? ""
            }
          />
        ))}
      </div>
    </div>
  );
}

  function TreeNode({
  node,
  depth,
  siblings,
  onOpenPath,
  onOpenNew,
  onToggle,
  onContextMenu,
  onSelect,
  getEntries,
  getState,
  isExpanded,
  isSelected,
  activePath,
}: {
  node: GithubEntry;
  depth: number;
  siblings: GithubEntry[];
  onOpenPath: (p: string, k: "file" | "dir") => void;
  onOpenNew: (p: string, k: "file" | "dir") => void;
  onToggle: (p: string, v?: boolean) => void;
  onContextMenu: (
    e: React.MouseEvent,
    node: GithubEntry,
    siblings: GithubEntry[]
  ) => void;
  onSelect: (
    node: GithubEntry,
    siblings: GithubEntry[],
    mod: "none" | "ctrl" | "shift"
  ) => void;
  getEntries: (p: string) => GithubEntry[];
  getState: (p: string) => string;
  isExpanded: (p: string) => boolean;
  isSelected: (p: string) => boolean;
  activePath: string;
}) {
  const expanded = node.type === "dir" && isExpanded(node.path);
  const selected = isSelected(node.path);
  const active = node.path === activePath;
  const children = getEntries(node.path);
  const childState = getState(node.path);

  const longPress = useRef<number | null>(null);
  const longFired = useRef(false);
  const startPos = useRef<{ x: number; y: number } | null>(null);

  function startLongPress(e: React.PointerEvent, node: GithubEntry) {
    longFired.current = false;
    startPos.current = { x: e.clientX, y: e.clientY };
    longPress.current = window.setTimeout(() => {
      longFired.current = true;
      const ev = new MouseEvent("contextmenu", {
        bubbles: true,
        clientX: e.clientX,
        clientY: e.clientY,
      });
      (e.target as HTMLElement).dispatchEvent(ev);
    }, 500);
  }
  function clearLongPress() {
    if (longPress.current) {
      clearTimeout(longPress.current);
      longPress.current = null;
    }
  }

  function modifiers(e: React.MouseEvent): "none" | "ctrl" | "shift" {
    if (e.metaKey || e.ctrlKey) return "ctrl";
    if (e.shiftKey) return "shift";
    return "none";
  }

  return (
    <div>
      <div
        draggable
        onDragStart={(e) => {
          const payload: GhNodeDrag = { path: node.path, kind: node.type };
          e.dataTransfer.effectAllowed = "copyLink";
          e.dataTransfer.setData(GH_NODE_MIME, JSON.stringify(payload));
          e.dataTransfer.setData("text/plain", node.path);
          if (!selected) onSelect(node, siblings, "none");
        }}
        onClick={(e) => {
          if (longFired.current) {
            longFired.current = false;
            return;
          }
          onSelect(node, siblings, modifiers(e));
        }}
        onDoubleClick={() => onOpenPath(node.path, node.type)}
        onAuxClick={(e) => {
          if (e.button === 1) {
            e.preventDefault();
            onOpenNew(node.path, node.type);
          }
        }}
        onContextMenu={(e) => onContextMenu(e, node, siblings)}
        onPointerDown={(e) => {
          if (e.pointerType === "touch") startLongPress(e, node);
        }}
        onPointerMove={(e) => {
          if (startPos.current) {
            const dx = Math.abs(e.clientX - startPos.current.x);
            const dy = Math.abs(e.clientY - startPos.current.y);
            if (dx > 10 || dy > 10) clearLongPress();
          }
        }}
        onPointerUp={clearLongPress}
        onPointerLeave={clearLongPress}
        className={[
          "group flex cursor-pointer items-center gap-1.5 py-1 pr-2 text-neutral-300 hover:bg-neutral-800/60",
          selected ? "bg-blue-600/20" : "",
          active ? "bg-neutral-800" : "",
        ].join(" ")}
        style={{ paddingLeft: 8 + depth * 14 }}
      >
        {node.type === "dir" ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle(node.path);
            }}
            onDoubleClick={(e) => e.stopPropagation()}
            className="flex h-4 w-4 shrink-0 items-center justify-center text-neutral-500 hover:text-neutral-200"
          >
            {expanded ? (
              <ChevronDown width={14} height={14} />
            ) : (
              <ChevronRight width={14} height={14} />
            )}
          </button>
        ) : (
          <span className="h-4 w-4 shrink-0" />
        )}

        {node.type === "dir" ? (
          expanded ? (
            <FolderOpen width={15} height={15} className="shrink-0 text-amber-400" />
          ) : (
            <Folder width={15} height={15} className="shrink-0 text-amber-400" />
          )
        ) : (
          fileIcon(node.name)
        )}

        <span
          className={[
            "truncate",
            active ? "text-neutral-100" : "",
            node.type === "dir" ? "font-medium" : "",
          ].join(" ")}
        >
          {node.name}
        </span>

        {node.type === "dir" && expanded && childState === "loading" && (
          <Spinner width={12} height={12} className="ml-auto text-blue-400" />
        )}
      </div>

      {expanded && (
        <div>
          {childState === "loading" && children.length === 0 && (
            <div
              className="flex items-center gap-2 py-1 text-neutral-500"
              style={{ paddingLeft: 8 + (depth + 1) * 14 }}
            >
              <Spinner width={12} height={12} className="text-blue-400" />
              Loading…
            </div>
          )}
          {childState === "error" && (
            <div
              className="py-1 text-red-400"
              style={{ paddingLeft: 8 + (depth + 1) * 14 }}
            >
              Failed to load.
            </div>
          )}
          {children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              siblings={children}
              onOpenPath={onOpenPath}
              onOpenNew={onOpenNew}
              onToggle={onToggle}
              onContextMenu={onContextMenu}
              onSelect={onSelect}
              getEntries={getEntries}
              getState={getState}
              isExpanded={isExpanded}
              isSelected={isSelected}
              activePath={activePath}
            />
          ))}
        </div>
      )}
    </div>
  );
}
