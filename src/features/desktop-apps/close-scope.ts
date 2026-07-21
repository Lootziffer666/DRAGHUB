import type { DesktopWindowState, WindowCloseContext } from "@/features/desktop/types";

/**
 * The exact domain state a window-close transaction is allowed to touch.
 * Derived once from the close context and used by BOTH inspection and
 * resolution, so what the dialog reports is exactly what resolving acts on —
 * closing a single editor can never commit or discard unrelated drafts or a
 * repository's whole working-changes bucket.
 */
export type CloseDomainScope =
  | {
      /** Repository parent: every dirty draft of the repository, the whole
       * working-changes bucket, and the owned editor children (for blocker
       * attribution). */
      kind: "repository";
      repoKey: string;
      parentWindowId: string;
      editorChildren: { windowId: string; path: string }[];
    }
  | {
      /** A single file-editor child: exactly this one file's draft. Never
       * other drafts, never the repository bucket. */
      kind: "single-editor";
      windowId: string;
      repoKey: string;
      path: string;
    }
  | {
      /** Viewers, GitHub-feature, tool and system windows own no repo-wide
       * domain state: nothing to inspect, nothing to commit or discard. */
      kind: "none";
    };

type CloseContextLike = Pick<WindowCloseContext, "target" | "children">;

export function deriveCloseDomainScope(context: CloseContextLike): CloseDomainScope {
  const { target, children } = context;

  if (
    target.applicationId === "repository-explorer" &&
    target.resource.type === "repository"
  ) {
    return {
      kind: "repository",
      repoKey: target.resource.repoKey,
      parentWindowId: target.id,
      editorChildren: children
        .filter(
          (w): w is DesktopWindowState & { resource: { type: "file"; repoKey: string; path: string } } =>
            w.applicationId === "file-editor" && w.resource.type === "file"
        )
        .map((w) => ({ windowId: w.id, path: w.resource.path })),
    };
  }

  if (target.applicationId === "file-editor" && target.resource.type === "file") {
    return {
      kind: "single-editor",
      windowId: target.id,
      repoKey: target.resource.repoKey,
      path: target.resource.path,
    };
  }

  // image-viewer, github-feature, tool and system windows: a viewer must not
  // be blocked just because the same file is dirty in some editor, and no
  // application gets repo-wide drafts or working changes implicitly.
  return { kind: "none" };
}
