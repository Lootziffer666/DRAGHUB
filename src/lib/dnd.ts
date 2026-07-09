export const GH_NODE_MIME = "application/x-gh-node";

export type GhNodeDrag = {
  path: string;
  kind: "file" | "dir";
  tabIndex?: number;
};
