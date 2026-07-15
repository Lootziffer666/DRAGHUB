"use client";

import { useRef } from "react";
import { useStore } from "@/lib/store";
import { useUI } from "./ui-context";
import type { MenuItem } from "./ContextMenu";
import { GH_NODE_MIME, type GhNodeDrag } from "@/lib/dnd";
import { useChanges } from "@/features/changes";
import {
  overlayDirEntries,
  readPathFor,
  type OverlayEntry,
} from "@/features/changes/overlay";
import { promptNewName, promptRename, nameCollides } from "@/features/changes/actions";
import { joinPath, parentOfPath, baseNameOfPath } from "@/lib/github-ops";
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  Edit,
  ExternalLink,
  FileIcon,
  FilePlus,
  FileImage,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  Refresh,
  Spinner,
  Trash,
  Undo,
} from "./icons";

function fileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (["png", "jpg", "jpeg", "gif", "svg", "webp", "ico", "bmp"].includes(ext))
    return <FileImage width={15} height={15} className="shrink-0 text-pink-400" />;
  if (["md", "txt", "mdx", "rst"].includes(ext))
    return <FileText width={15} height={15} className="shrink-0 text-neutral-400" />;
  return <FileIcon width={15} height={15} className="shrink-0 text-sky-400" />;
}

export function Explorer() {
  const {
    state,
    toggleExpand,
    ensureDir,
    invalidateDir,
    openPath,
    openInNewTab,
    setSelection,
  } = useStore();
  const { changes, stageAddFile, stageAddFolder, stageDelete, stageRename, discardChange } =
    useChanges();
  const { openMenu } = useUI();
  const anchor = useRef<string | null>(null);

  if (!state.meta) return null;

  const meta = state.meta;
  const rootRaw = state.treeCache[""] ?? [];
  const rootState = state.treeState[""] ?? "loading";
  const rootEntries = overlayDirEntries("", rootRaw, changes);

  function copy(text: string) {
    navigator.clipboard?.writeText(text).catch(() => {});
  }

  function overlayFor(dirPath: string): OverlayEntry[] {
    return overlayDirEntries(dirPath, state.treeCache[dirPath] ?? [], changes);
  }

  async function createFile(dirPath: string) {
    const name = promptNewName("file");
    if (!name) return;
    if (nameCollides(overlayFor(dirPath), name)) {
      window.alert(`"${name}" already exists in this folder.`);
      return;
    }
    await stageAddFile(joinPath(dirPath, name), new Uint8Array(0));
  }

  function createFolder(dirPath: string) {
    const name = promptNewName("folder");
    if (!name) return;
    if (nameCollides(overlayFor(dirPath), name)) {
      window.alert(`"${name}" already exists in this folder.`);
      return;
    }
    stageAddFolder(joinPath(dirPath, name));
  }

  function renameEntry(node: OverlayEntry) {
    const newName = promptRename(node.name);
    if (!newName) return;
    const dir = parentOfPath(node.path);
    if (nameCollides(overlayFor(dir).filter((e) => e.path !== node.path), newName)) {
      window.alert(`"${newName}" already exists in this folder.`);
      return;
    }
    stageRename(node.path, joinPath(dir, newName), node.type);
  }

  function deleteEntry(node: OverlayEntry) {
    const label = node.type === "dir" ? "folder" : "file";
    if (
      !window.confirm(
        `Delete ${label} "${node.path}"? This is staged until you create a checkpoint.`
      )
    )
      return;
    stageDelete(node.path, node.type);
  }

  function restoreEntry(node: OverlayEntry) {
    if (node.changeId) discardChange(node.changeId);
  }

  function moveInto(payload: GhNodeDrag, targetDir: string) {
    if (payload.path === targetDir) return;
    if (targetDir.startsWith(`${payload.path}/`)) {
      window.alert("Can't move a folder into itself.");
      return;
    }
    const name = baseNameOfPath(payload.path);
    const newPath = joinPath(targetDir, name);
    if (newPath === payload.path) return;
    if (nameCollides(overlayFor(targetDir), name)) {
      window.alert(`"${name}" already exists in the target folder.`);
      return;
    }
    stageRename(payload.path, newPath, payload.kind);
  }

  function nodeMenuItems(
    node: OverlayEntry,
    descendantOfRename: boolean
  ): MenuItem[] {
    const readTarget = readPathFor(node, changes);
    const ghUrl = `${meta.htmlUrl}/${node.type === "dir" ? "tree" : "blob"}/${meta.branch}/${node.path}`;
    const isPendingNewFile = node.status === "added" && node.type === "file";
    const items: MenuItem[] = [];

    if (!isPendingNewFile) {
      items.push(
        { id: "open", label: "Open", shortcut: "↵", onClick: () => openPath(readTarget, node.type) },
        {
          id: "open-new",
          label: "Open in New Tab",
          shortcut: "⌘/Ctrl+↵",
          onClick: () => openInNewTab(readTarget, node.type),
        }
      );
    } else {
      items.push({
        id: "note",
        label: "New file — viewable after checkpoint",
        disabled: true,
      });
    }

    if (node.type === "dir") {
      items.push(
        {
          id: "refresh",
          label: "Refresh",
          icon: <Refresh width={15} height={15} />,
          separatorBefore: true,
          onClick: () => {
            invalidateDir(readTarget);
            toggleExpand(readTarget, true);
          },
        },
        {
          id: "new-file",
          label: "New File",
          icon: <FilePlus width={15} height={15} />,
          separatorBefore: true,
          onClick: () => void createFile(node.path),
        },
        {
          id: "new-folder",
          label: "New Folder",
          icon: <FolderPlus width={15} height={15} />,
          onClick: () => createFolder(node.path),
        }
      );
    }

    if (node.status === "pending-delete") {
      items.push({
        id: "restore",
        label: "Restore",
        icon: <Undo width={15} height={15} />,
        separatorBefore: true,
        onClick: () => restoreEntry(node),
      });
    } else if (!(descendantOfRename && node.status === "unchanged")) {
      items.push({
        id: "rename",
        label: "Rename",
        icon: <Edit width={15} height={15} />,
        separatorBefore: true,
        onClick: () => renameEntry(node),
      });
      if (node.status === "added" || node.status === "renamed-in") {
        items.push({
          id: "discard",
          label: "Discard",
          icon: <Undo width={15} height={15} />,
          danger: true,
          onClick: () => restoreEntry(node),
        });
      } else {
        items.push({
          id: "delete",
          label: "Delete",
          icon: <Trash width={15} height={15} />,
          danger: true,
          onClick: () => deleteEntry(node),
        });
      }
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
    if (node.type === "file" && !isPendingNewFile) {
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

  function rootMenuItems(): MenuItem[] {
    return [
      {
        id: "new-file",
        label: "New File",
        icon: <FilePlus width={15} height={15} />,
        onClick: () => void createFile(""),
      },
      {
        id: "new-folder",
        label: "New Folder",
        icon: <FolderPlus width={15} height={15} />,
        onClick: () => createFolder(""),
      },
    ];
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
    node: OverlayEntry,
    descendantOfRename: boolean
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
      openMenu(e.clientX, e.clientY, nodeMenuItems(node, descendantOfRename));
    }
  }

  function selectNode(
    node: OverlayEntry,
    siblings: OverlayEntry[],
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
        <div className="flex items-center gap-1">
          <button
            onClick={() => void createFile("")}
            title="New file at root"
            className="flex h-6 w-6 items-center justify-center rounded text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
          >
            <FilePlus width={14} height={14} />
          </button>
          <button
            onClick={() => createFolder("")}
            title="New folder at root"
            className="flex h-6 w-6 items-center justify-center rounded text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
          >
            <FolderPlus width={14} height={14} />
          </button>
          <button
            onClick={() => {
              invalidateDir("");
              void ensureDir("");
            }}
            title="Refresh root"
            className="flex h-6 w-6 items-center justify-center rounded text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
          >
            <Refresh width={14} height={14} />
          </button>
        </div>
      </div>

      <div
        className="flex-1 overflow-auto py-1 text-[13px]"
        onContextMenu={(e) => {
          e.preventDefault();
          openMenu(e.clientX, e.clientY, rootMenuItems());
        }}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes(GH_NODE_MIME)) e.preventDefault();
        }}
        onDrop={(e) => {
          if (!e.dataTransfer.types.includes(GH_NODE_MIME)) return;
          e.preventDefault();
          const raw = e.dataTransfer.getData(GH_NODE_MIME);
          if (!raw) return;
          try {
            moveInto(JSON.parse(raw) as GhNodeDrag, "");
          } catch {
            /* ignore malformed payload */
          }
        }}
      >
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
            descendantOfRename={false}
            onOpenPath={openPath}
            onOpenNew={openInNewTab}
            onToggle={toggleExpand}
            onContextMenu={onContextMenu}
            onSelect={selectNode}
            onMoveInto={moveInto}
            getRawEntries={(p) => state.treeCache[p] ?? []}
            getState={(p) => state.treeState[p] ?? "loading"}
            isExpanded={(p) => !!state.expanded[p]}
            isSelected={(p) => state.selection.includes(p)}
            changes={changes}
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
  descendantOfRename,
  onOpenPath,
  onOpenNew,
  onToggle,
  onContextMenu,
  onSelect,
  onMoveInto,
  getRawEntries,
  getState,
  isExpanded,
  isSelected,
  changes,
  activePath,
}: {
  node: OverlayEntry;
  depth: number;
  siblings: OverlayEntry[];
  descendantOfRename: boolean;
  onOpenPath: (p: string, k: "file" | "dir") => void;
  onOpenNew: (p: string, k: "file" | "dir") => void;
  onToggle: (p: string, v?: boolean) => void;
  onContextMenu: (
    e: React.MouseEvent,
    node: OverlayEntry,
    descendantOfRename: boolean
  ) => void;
  onSelect: (
    node: OverlayEntry,
    siblings: OverlayEntry[],
    mod: "none" | "ctrl" | "shift"
  ) => void;
  onMoveInto: (payload: GhNodeDrag, targetDir: string) => void;
  getRawEntries: (p: string) => import("@/lib/github").GithubEntry[];
  getState: (p: string) => string;
  isExpanded: (p: string) => boolean;
  isSelected: (p: string) => boolean;
  changes: ReturnType<typeof useChanges>["changes"];
  activePath: string;
}) {
  const readPath = readPathFor(node, changes);
  const expanded = node.type === "dir" && isExpanded(readPath);
  const selected = isSelected(node.path);
  const active = node.path === activePath || readPath === activePath;
  const rawChildren = getRawEntries(readPath);
  const children = overlayDirEntries(node.path, rawChildren, changes);
  const childState = getState(readPath);
  const draggable = !(descendantOfRename && node.status === "unchanged");
  const canDrop = node.type === "dir";

  const longPress = useRef<number | null>(null);
  const longFired = useRef(false);
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const dragOver = useRef(false);

  function startLongPress(e: React.PointerEvent) {
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

  const statusBadge =
    node.status === "added" ? (
      <span className="ml-1 shrink-0 rounded bg-emerald-500/20 px-1 text-[10px] font-medium text-emerald-400">
        new
      </span>
    ) : node.status === "renamed-in" ? (
      <span className="ml-1 shrink-0 rounded bg-blue-500/20 px-1 text-[10px] font-medium text-blue-400">
        renamed
      </span>
    ) : node.status === "pending-delete" ? (
      <span className="ml-1 shrink-0 rounded bg-red-500/20 px-1 text-[10px] font-medium text-red-400">
        deleting
      </span>
    ) : null;

  return (
    <div>
      <div
        draggable={draggable}
        onDragStart={(e) => {
          if (!draggable) {
            e.preventDefault();
            return;
          }
          const payload: GhNodeDrag = { path: node.path, kind: node.type };
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData(GH_NODE_MIME, JSON.stringify(payload));
          e.dataTransfer.setData("text/plain", node.path);
          if (!selected) onSelect(node, siblings, "none");
        }}
        onDragOver={(e) => {
          if (canDrop && e.dataTransfer.types.includes(GH_NODE_MIME)) {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            dragOver.current = true;
          }
        }}
        onDrop={(e) => {
          if (!canDrop || !e.dataTransfer.types.includes(GH_NODE_MIME)) return;
          e.preventDefault();
          e.stopPropagation();
          const raw = e.dataTransfer.getData(GH_NODE_MIME);
          if (!raw) return;
          try {
            onMoveInto(JSON.parse(raw) as GhNodeDrag, node.path);
          } catch {
            /* ignore malformed payload */
          }
        }}
        onClick={(e) => {
          if (longFired.current) {
            longFired.current = false;
            return;
          }
          onSelect(node, siblings, modifiers(e));
        }}
        onDoubleClick={() => {
          if (node.status === "added" && node.type === "file") return;
          onOpenPath(readPath, node.type);
        }}
        onAuxClick={(e) => {
          if (e.button === 1) {
            e.preventDefault();
            if (node.status === "added" && node.type === "file") return;
            onOpenNew(readPath, node.type);
          }
        }}
        onContextMenu={(e) => onContextMenu(e, node, descendantOfRename)}
        onPointerDown={(e) => {
          if (e.pointerType === "touch") startLongPress(e);
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
          node.status === "pending-delete" ? "opacity-50 line-through" : "",
        ].join(" ")}
        style={{ paddingLeft: 8 + depth * 14 }}
      >
        {node.type === "dir" ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle(readPath);
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
        {statusBadge}

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
              descendantOfRename={descendantOfRename || node.status === "renamed-in"}
              onOpenPath={onOpenPath}
              onOpenNew={onOpenNew}
              onToggle={onToggle}
              onContextMenu={onContextMenu}
              onSelect={onSelect}
              onMoveInto={onMoveInto}
              getRawEntries={getRawEntries}
              getState={getState}
              isExpanded={isExpanded}
              isSelected={isSelected}
              changes={changes}
              activePath={activePath}
            />
          ))}
        </div>
      )}
    </div>
  );
}
