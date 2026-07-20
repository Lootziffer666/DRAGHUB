import { closeWindowState } from "./window-state";
import type {
  DesktopSession,
  WindowCloseContext,
  WindowCloseResolution,
  WindowLifecycleAdapter,
} from "./types";
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
