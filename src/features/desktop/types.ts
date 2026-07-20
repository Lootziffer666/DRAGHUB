import type React from "react";
export type WindowId = string;
export type DesktopIconId = string;
export type RepoKey = string;
export type WindowKind =
  | "repository"
  | "viewer"
  | "editor"
  | "github-feature"
  | "tool"
  | "system";
export type WindowOwner =
  | { type: "desktop" }
  | { type: "repository"; repoKey: RepoKey; repositoryWindowId: WindowId };
export type WindowBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};
export type WindowResource =
  | { type: "repository"; repoKey: RepoKey }
  | { type: "file"; repoKey: RepoKey; path: string }
  | { type: "github-feature"; repoKey: RepoKey; featureId: string }
  | { type: "tool"; toolId: string }
  | { type: "system"; systemId: string };
export type DesktopWindowState = {
  id: WindowId;
  kind: WindowKind;
  applicationId: string;
  owner: WindowOwner;
  resource: WindowResource;
  title: string;
  iconKey: string;
  state: "normal" | "minimized" | "maximized";
  bounds: WindowBounds;
  restoreBounds?: WindowBounds;
  zIndex: number;
  groupKey: string;
  createdAt: number;
  lastFocusedAt: number;
};
export type DesktopIconState = {
  id: DesktopIconId;
  kind: "repository-drive" | "recycle-bin" | "settings" | "shortcut";
  title: string;
  iconKey: string;
  resource?: WindowResource;
  position: { x: number; y: number };
  selected: boolean;
  pinned: boolean;
};
export type RubberBandEdge = "top" | "left" | "right" | "bottom";
export type RubberBandState = {
  repoKey: RepoKey;
  repositoryWindowId: WindowId;
  edge: RubberBandEdge;
  collapsed: boolean;
  autoHide: boolean;
  itemOrder: string[];
};
export type WindowContentProps = {
  windowId: WindowId;
  resource: WindowResource;
  owner: WindowOwner;
};
export type WindowApplicationDefinition = {
  id: string;
  kind: WindowKind;
  title: string;
  iconKey: string;
  defaultSize: { width: number; height: number };
  minimumSize: { width: number; height: number };
  allowMultiple: boolean;
  render: (props: WindowContentProps) => React.ReactNode;
};
export interface DesktopRuntimeAdapter {
  openRepository(
    resource: Extract<WindowResource, { type: "repository" }>,
  ): Promise<void>;
  openFile(resource: Extract<WindowResource, { type: "file" }>): Promise<void>;
  openEditor(
    resource: Extract<WindowResource, { type: "file" }>,
  ): Promise<void>;
  openTerminal?(repoKey: RepoKey): Promise<void>;
  openGithubFeature?(
    resource: Extract<WindowResource, { type: "github-feature" }>,
  ): Promise<void>;
}
export type OpenWindowInput = {
  applicationId: string;
  owner: WindowOwner;
  resource: WindowResource;
  title?: string;
  groupKey?: string;
  bounds?: Partial<WindowBounds>;
  id?: string;
};
export type DesktopSession = {
  windows: DesktopWindowState[];
  icons: DesktopIconState[];
  rubberBands: RubberBandState[];
  taskbarOrder: string[];
  pendingCloseId: null | WindowId;
  mobileActiveWindowId: null | WindowId;
  closeContext: WindowCloseContext | null;
  recycleBin: RecycleBinEntry[];
};
export type WindowCloseReason =
  | "user-request"
  | "parent-window-closing"
  | "group-close"
  | "desktop-reset";
export type WindowCloseBlocker =
  | { type: "unsaved-draft"; windowId: WindowId; label: string }
  | { type: "working-changes"; windowId: WindowId; count: number }
  | { type: "running-operation"; windowId: WindowId; label: string };
export type WindowCloseResolution =
  | { action: "close-clean" }
  | { action: "commit-and-close" }
  | { action: "discard-to-recycle-bin-and-close" }
  | { action: "cancel" };
export type WindowCloseContext = {
  target: DesktopWindowState;
  children: DesktopWindowState[];
  blockers: WindowCloseBlocker[];
  reason: WindowCloseReason;
  error?: string;
};
export type RecycleBinEntry = {
  id: string;
  sourceWindowId: WindowId;
  repoKey?: RepoKey;
  type: "draft" | "working-change";
  path?: string;
  label: string;
  content?: string;
  discardedAt: number;
};
export interface WindowLifecycleAdapter {
  inspectClose(
    context: Omit<WindowCloseContext, "blockers">,
  ): Promise<WindowCloseBlocker[]>;
  resolveClose(
    context: WindowCloseContext,
    resolution: WindowCloseResolution,
  ): Promise<{ success: boolean; error?: string }>;
}
