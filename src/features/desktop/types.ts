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
};
