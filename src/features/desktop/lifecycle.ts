import { closeWindowState } from "./window-state";
import type {
  DesktopSession,
  WindowCloseContext,
  WindowCloseResolution,
  WindowLifecycleAdapter,
} from "./types";
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
    resolution.action === "discard-to-recycle-bin-and-close",
  );
}
