import { closeWindowState } from "./window-state";
import type {
  DesktopSession,
  WindowCloseContext,
  WindowCloseResolution,
  WindowLifecycleAdapter,
} from "./types";

export type CloseDomainScope =
  | { mode: "repository"; repoKey: string }
  | { mode: "editor"; repoKey: string; path: string }
  | { mode: "viewer"; repoKey: string; path: string }
  | { mode: "application"; applicationId: string; repoKey: string | null };

export type CloseInspectionContext = Omit<
  WindowCloseContext,
  "blockers" | "inspectionStatus" | "resolutionStatus"
>;

export function deriveCloseDomainScope(
  context: CloseInspectionContext,
): CloseDomainScope {
  const { target } = context;
  const resource = target.resource;
  switch (target.applicationId) {
    case "repository-explorer":
      if (resource.type === "repository")
        return { mode: "repository", repoKey: resource.repoKey };
      break;
    case "file-editor":
      if (resource.type === "file")
        return {
          mode: "editor",
          repoKey: resource.repoKey,
          path: resource.path,
        };
      break;
    case "image-viewer":
      if (resource.type === "file")
        return {
          mode: "viewer",
          repoKey: resource.repoKey,
          path: resource.path,
        };
      break;
    case "github-feature":
      return {
        mode: "application",
        applicationId: target.applicationId,
        repoKey: resource.type === "github-feature" ? resource.repoKey : null,
      };
  }
  return {
    mode: "application",
    applicationId: target.applicationId,
    repoKey:
      target.owner.type === "repository" ? target.owner.repoKey : null,
  };
}

export function languageFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    mjs: "javascript",
    cjs: "javascript",
    json: "json",
    md: "markdown",
    markdown: "markdown",
    css: "css",
    scss: "css",
    html: "html",
    htm: "html",
    svg: "xml",
    xml: "xml",
    py: "python",
    java: "java",
    c: "c",
    h: "c",
    cpp: "cpp",
    cc: "cpp",
    go: "go",
    rs: "rust",
    sh: "shell",
    bash: "shell",
    yml: "yaml",
    yaml: "yaml",
    txt: "plaintext",
  };
  return map[ext] ?? "plaintext";
}
export function canResolveClose(
  context: WindowCloseContext,
  resolution: WindowCloseResolution,
) {
  if (resolution.action === "cancel")
    return context.resolutionStatus === "idle";
  if (
    context.inspectionStatus !== "ready" ||
    context.resolutionStatus !== "idle"
  )
    return false;
  if (resolution.action === "close-clean") return context.blockers.length === 0;
  return context.blockers.length > 0;
}
export function applyCloseResolutionPending(
  session: DesktopSession,
  transactionId: string,
): DesktopSession {
  return session.closeContext?.transactionId === transactionId
    ? {
        ...session,
        closeContext: {
          ...session.closeContext,
          resolutionStatus: "pending",
          error: undefined,
        },
      }
    : session;
}
export function applyCloseResolutionFailure(
  session: DesktopSession,
  transactionId: string,
  message: string,
): DesktopSession {
  return session.closeContext?.transactionId === transactionId
    ? {
        ...session,
        closeContext: {
          ...session.closeContext,
          resolutionStatus: "idle",
          error: message,
        },
      }
    : session;
}
export async function resolveCloseTransaction(
  session: DesktopSession,
  context: WindowCloseContext,
  resolution: WindowCloseResolution,
  adapter: WindowLifecycleAdapter,
): Promise<DesktopSession> {
  if (resolution.action === "cancel")
    return { ...session, pendingCloseId: null, closeContext: null };
  const result = await adapter.resolveClose(context, resolution);
  if (!result.success)
    return {
      ...session,
      closeContext: {
        ...context,
        error: result.error ?? "Close resolution failed",
      },
    };
  return closeWindowState(
    session,
    context.target.id,
    result.recycleBinEntries ?? [],
  );
}
