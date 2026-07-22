import type { WindowApplicationDefinition } from "./types";
import { RepositoryExplorerApp } from "@/features/desktop-apps/RepositoryExplorerApp";
import {
  FileViewerApp,
  FileEditorApp,
  ConflictResolverApp,
} from "@/features/desktop-apps/FileWindowApp";
import { RawTextViewerApp } from "@/features/desktop-apps/RawTextViewerApp";
import { AudioPlayerApp } from "@/features/desktop-apps/AudioPlayerApp";
import { GithubFeatureApp } from "@/features/desktop-apps/GithubFeatureApp";
import { ScratchpadApp } from "@/features/desktop-apps/ScratchpadApp";
import { SettingsApp } from "@/features/desktop-apps/SettingsApp";
import { RecycleBinApp } from "@/features/desktop-apps/RecycleBinApp";
import { StarredReposApp } from "@/features/desktop-apps/StarredReposApp";
const definitions: WindowApplicationDefinition[] = [
  {
    id: "repository-explorer",
    kind: "repository",
    title: "Repository Explorer",
    iconKey: "repo",
    defaultSize: { width: 900, height: 620 },
    minimumSize: { width: 520, height: 360 },
    allowMultiple: true,
    render: (p) => <RepositoryExplorerApp {...p} />,
  },
  {
    id: "image-viewer",
    kind: "viewer",
    title: "File Viewer",
    iconKey: "image",
    defaultSize: { width: 640, height: 480 },
    minimumSize: { width: 380, height: 280 },
    allowMultiple: true,
    render: (p) => <FileViewerApp {...p} />,
  },
  {
    id: "file-editor",
    kind: "editor",
    title: "Code Editor",
    iconKey: "tool",
    defaultSize: { width: 720, height: 540 },
    minimumSize: { width: 420, height: 300 },
    allowMultiple: true,
    render: (p) => <FileEditorApp {...p} />,
  },
  {
    id: "conflict-resolver",
    kind: "editor",
    title: "Resolve Conflicts",
    iconKey: "tool",
    defaultSize: { width: 920, height: 640 },
    minimumSize: { width: 560, height: 400 },
    allowMultiple: true,
    render: (p) => <ConflictResolverApp {...p} />,
  },
  {
    id: "raw-text-viewer",
    kind: "viewer",
    title: "Raw Text",
    iconKey: "tool",
    defaultSize: { width: 640, height: 480 },
    minimumSize: { width: 380, height: 280 },
    allowMultiple: true,
    render: (p) => <RawTextViewerApp {...p} />,
  },
  {
    id: "audio-player",
    kind: "viewer",
    title: "Audio Player",
    iconKey: "tool",
    defaultSize: { width: 420, height: 300 },
    minimumSize: { width: 320, height: 240 },
    allowMultiple: true,
    render: (p) => <AudioPlayerApp {...p} />,
  },
  {
    id: "github-feature",
    kind: "github-feature",
    title: "GitHub Feature",
    iconKey: "github",
    defaultSize: { width: 640, height: 480 },
    minimumSize: { width: 380, height: 280 },
    allowMultiple: true,
    render: (p) => <GithubFeatureApp {...p} />,
  },
  {
    id: "tool-window",
    kind: "tool",
    title: "Scratchpad",
    iconKey: "tool",
    defaultSize: { width: 490, height: 350 },
    minimumSize: { width: 340, height: 240 },
    allowMultiple: true,
    render: (p) => <ScratchpadApp {...p} />,
  },
  {
    id: "settings",
    kind: "system",
    title: "Settings",
    iconKey: "settings",
    defaultSize: { width: 560, height: 430 },
    minimumSize: { width: 360, height: 260 },
    allowMultiple: false,
    render: () => <SettingsApp />,
  },
  {
    id: "recycle-bin",
    kind: "system",
    title: "Recycle Bin",
    iconKey: "bin",
    defaultSize: { width: 680, height: 500 },
    minimumSize: { width: 400, height: 300 },
    allowMultiple: false,
    render: () => <RecycleBinApp />,
  },
  {
    id: "starred-repos",
    kind: "system",
    title: "Starred Repositories",
    iconKey: "star",
    defaultSize: { width: 560, height: 520 },
    minimumSize: { width: 380, height: 320 },
    allowMultiple: false,
    render: () => <StarredReposApp />,
  },
];
export const applicationRegistry = new Map(definitions.map((d) => [d.id, d]));
export function getApplication(id: string) {
  const app = applicationRegistry.get(id);
  if (!app) throw new Error(`Unknown desktop application: ${id}`);
  return app;
}
