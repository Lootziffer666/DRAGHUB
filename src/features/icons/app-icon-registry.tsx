import type { ComponentType, SVGProps } from "react";
import {
  AppFolderRegular,
  AppsRegular,
  ArrowClockwiseRegular,
  ArrowDownloadRegular,
  ArrowSyncRegular,
  ArrowUploadRegular,
  BinRecycleRegular,
  BranchForkRegular,
  BranchRequestRegular,
  BugRegular,
  CopyRegular,
  DeleteRegular,
  DismissRegular,
  EditRegular,
  FlashRegular,
  FolderRegular,
  GlobeRegular,
  ImageRegular,
  OpenRegular,
  SaveRegular,
  SearchRegular,
  SettingsRegular,
  ShieldCheckmarkRegular,
  TableRegular,
  TagRegular,
} from "./fluent-icons";
import { DraghubMark, GithubMark } from "./brand-marks";

export type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

/**
 * Every application/desktop-level icon key DRAGHUB persists or resolves at
 * render time. Window and desktop-icon state only ever stores the STRING
 * key (`DesktopWindowState.iconKey`, `DesktopIconState.iconKey`,
 * `WindowApplicationDefinition.iconKey`) — never a component — so old
 * sessions restore correctly even if the icon mapping changes later.
 */
export type AppIconKey =
  | "repository"
  | "image"
  | "code"
  | "github"
  | "settings"
  | "recycle-bin"
  | "search"
  | "launcher"
  | "changes"
  | "pull-requests"
  | "issues"
  | "actions"
  | "triage"
  | "releases"
  | "security"
  | "upload"
  | "branch"
  | "open-external"
  | "copy"
  | "edit"
  | "save"
  | "close"
  | "refresh"
  | "world";

const appIcons: Record<AppIconKey, IconComponent> = {
  repository: FolderRegular,
  image: ImageRegular,
  // Shared by file-editor and Scratchpad, which both persist the legacy
  // "tool" iconKey (see legacyIconKeyAliases below).
  code: AppFolderRegular,
  github: GithubMark,
  settings: SettingsRegular,
  "recycle-bin": BinRecycleRegular,
  search: SearchRegular,
  launcher: AppsRegular,
  changes: ArrowSyncRegular,
  "pull-requests": BranchRequestRegular,
  issues: BugRegular,
  actions: FlashRegular,
  triage: TableRegular,
  releases: TagRegular,
  security: ShieldCheckmarkRegular,
  upload: ArrowUploadRegular,
  branch: BranchForkRegular,
  "open-external": OpenRegular,
  copy: CopyRegular,
  edit: EditRegular,
  save: SaveRegular,
  close: DismissRegular,
  refresh: ArrowClockwiseRegular,
  world: GlobeRegular,
};

/** Resolves a semantic app/desktop icon key to its component. Unknown keys
 * (e.g. a persisted key from a since-removed application) fall back to the
 * DRAGHUB mark rather than throwing, so old sessions keep rendering. */
export function resolveAppIcon(key: string): IconComponent {
  return appIcons[key as AppIconKey] ?? DraghubMark;
}

/**
 * Legacy `iconKey` values already persisted in DesktopWindowState /
 * DesktopIconState / WindowApplicationDefinition (`repo`, `image`, `tool`,
 * `github`, `settings`, `bin`). Mapped onto the semantic keys above so
 * existing sessions resolve to a real Fluent icon without a persistence
 * migration.
 */
const legacyIconKeyAliases: Record<string, AppIconKey> = {
  repo: "repository",
  tool: "code",
  bin: "recycle-bin",
};

/** The single resolver every window-icon call site should use. */
export function appIconFor(iconKey: string): IconComponent {
  return resolveAppIcon(legacyIconKeyAliases[iconKey] ?? iconKey);
}
