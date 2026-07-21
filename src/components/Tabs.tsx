"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { useActiveRepo, useStore, type Tab } from "@/lib/store";
import { GH_NODE_MIME, type GhNodeDrag } from "@/lib/dnd";
import { subscribeDirty, getDirtyKeys, sessionKey } from "@/lib/editor-sessions";
import {
  DocumentRegular as FileIcon,
  FolderRegular as Folder,
  ReOrderDotsVerticalRegular as Grip,
  DismissRegular as X,
} from "@/features/icons";

const EMPTY_DIRTY: ReadonlySet<string> = new Set();

function useDirtyKeys(): ReadonlySet<string> {
  return useSyncExternalStore(subscribeDirty, getDirtyKeys, () => EMPTY_DIRTY);
}

export function Tabs() {
  const { setActiveTab, closeTab, moveTab, openInNewTab } = useStore();
  const repo = useActiveRepo();
  const dirtyKeys = useDirtyKeys();
  const dragIndex = useRef<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [dropActive, setDropActive] = useState(false);

  if (!repo || repo.tabs.length === 0) return null;

  return (
    <div
      className={[
        "flex items-stretch gap-0.5 overflow-x-auto border-b border-[var(--dh-window-border)] bg-[var(--dh-surface)] px-2 pt-1.5",
        dropActive ? "ring-1 ring-inset ring-blue-500/60" : "",
      ].join(" ")}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes(GH_NODE_MIME)) {
          e.preventDefault();
          setDropActive(true);
        }
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDropActive(false);
      }}
      onDrop={(e) => {
        if (e.dataTransfer.types.includes(GH_NODE_MIME)) {
          e.preventDefault();
          setDropActive(false);
          try {
            const payload = JSON.parse(
              e.dataTransfer.getData(GH_NODE_MIME)
            ) as GhNodeDrag;
            openInNewTab(payload.path, payload.kind);
          } catch {
            /* ignore */
          }
        }
      }}
    >
      {repo.tabs.map((tab, i) => (
        <TabButton
          key={tab.id}
          tab={tab}
          index={i}
          active={tab.id === repo.activeTabId}
          dirty={tab.kind === "file" && dirtyKeys.has(sessionKey(tab.repoKey, tab.path))}
          isOver={overIndex === i}
          onActivate={() => setActiveTab(tab.id)}
          onClose={(e) => {
            e.stopPropagation();
            closeTab(tab.id);
          }}
          onDragStart={() => {
            dragIndex.current = i;
          }}
          onDragEnter={() => setOverIndex(i)}
          onDragEnd={() => {
            if (dragIndex.current !== null && overIndex !== null) {
              moveTab(dragIndex.current, overIndex);
            }
            dragIndex.current = null;
            setOverIndex(null);
          }}
        />
      ))}
    </div>
  );
}

function TabButton({
  tab,
  index,
  active,
  dirty,
  isOver,
  onActivate,
  onClose,
  onDragStart,
  onDragEnter,
  onDragEnd,
}: {
  tab: Tab;
  index: number;
  active: boolean;
  dirty: boolean;
  isOver: boolean;
  onActivate: () => void;
  onClose: (e: React.MouseEvent) => void;
  onDragStart: () => void;
  onDragEnter: () => void;
  onDragEnd: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", `${tab.repoKey}#${tab.path}`);
        e.dataTransfer.setData(
          GH_NODE_MIME,
          JSON.stringify({ path: tab.path, kind: tab.kind, tabIndex: index })
        );
        onDragStart();
      }}
      onDragEnter={onDragEnter}
      onDragEnd={onDragEnd}
      onDragOver={(e) => e.preventDefault()}
      onClick={onActivate}
      onAuxClick={(e) => {
        if (e.button === 1) {
          e.preventDefault();
          onClose(e);
        }
      }}
      title={`${tab.repoKey} / ${tab.path || "/"}`}
      className={[
        "group relative flex max-w-[200px] cursor-pointer items-center gap-2 rounded-t-md border-x border-t px-2.5 py-2 text-[13px] transition-colors",
        active
          ? "border-[var(--dh-window-border)] bg-[var(--dh-surface-raised)] text-[var(--dh-text)]"
          : "border-transparent bg-[var(--dh-surface-raised)]/40 text-[var(--dh-text-secondary)] hover:bg-[var(--dh-surface-raised)]/70 hover:text-[var(--dh-text)]",
        isOver ? "border-t-blue-500" : "",
      ].join(" ")}
    >
      <Grip
        width={12}
        height={12}
        className="shrink-0 text-[var(--dh-text-disabled)] group-hover:text-[var(--dh-text-secondary)]"
      />
      {tab.kind === "dir" ? (
        <Folder width={14} height={14} className="shrink-0 text-amber-700 dark:text-amber-400" />
      ) : (
        <FileIcon width={14} height={14} className="shrink-0 text-sky-700 dark:text-sky-400" />
      )}
      <span className="truncate">{tab.label}</span>
      {dirty && (
        <span
          title="Unsaved editor draft"
          className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400"
        />
      )}
      <button
        onClick={onClose}
        title="Close tab (middle-click)"
        className="ml-1 flex h-4 w-4 shrink-0 items-center justify-center rounded text-[var(--dh-text-secondary)] opacity-0 hover:bg-[var(--dh-surface-selected)] hover:text-[var(--dh-text)] group-hover:opacity-100"
      >
        <X width={12} height={12} />
      </button>
      {active && (
        <span className="absolute inset-x-0 -bottom-px h-0.5 bg-[var(--dh-lime-brand)]" />
      )}
    </div>
  );
}
