import type { WindowApplicationDefinition } from "./types";
import { MockRepositoryWindow } from "./demo/MockRepositoryWindow";
import { MockImageViewer } from "./demo/MockImageViewer";
import { MockGithubFeatureWindow } from "./demo/MockGithubFeatureWindow";
import { MockToolWindow } from "./demo/MockToolWindow";
import { MockSystemWindow } from "./demo/MockSystemWindow";
const definitions: WindowApplicationDefinition[] = [
  {
    id: "repository-explorer",
    kind: "repository",
    title: "Repository Explorer",
    iconKey: "repo",
    defaultSize: { width: 760, height: 540 },
    minimumSize: { width: 480, height: 330 },
    allowMultiple: true,
    render: (p) => <MockRepositoryWindow {...p} />,
  },
  {
    id: "image-viewer",
    kind: "viewer",
    title: "Image Viewer",
    iconKey: "image",
    defaultSize: { width: 570, height: 430 },
    minimumSize: { width: 380, height: 280 },
    allowMultiple: true,
    render: (p) => <MockImageViewer {...p} />,
  },
  {
    id: "github-feature",
    kind: "github-feature",
    title: "GitHub Feature",
    iconKey: "github",
    defaultSize: { width: 560, height: 400 },
    minimumSize: { width: 380, height: 260 },
    allowMultiple: true,
    render: (p) => <MockGithubFeatureWindow {...p} />,
  },
  {
    id: "tool-window",
    kind: "tool",
    title: "Desktop Tool",
    iconKey: "tool",
    defaultSize: { width: 490, height: 350 },
    minimumSize: { width: 340, height: 240 },
    allowMultiple: true,
    render: (p) => <MockToolWindow {...p} />,
  },
  {
    id: "system-window",
    kind: "system",
    title: "System",
    iconKey: "settings",
    defaultSize: { width: 520, height: 390 },
    minimumSize: { width: 360, height: 260 },
    allowMultiple: false,
    render: (p) => <MockSystemWindow {...p} />,
  },
];
export const applicationRegistry = new Map(definitions.map((d) => [d.id, d]));
export function getApplication(id: string) {
  const app = applicationRegistry.get(id);
  if (!app) throw new Error(`Unknown desktop application: ${id}`);
  return app;
}
