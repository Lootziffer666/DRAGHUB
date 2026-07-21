import type { FileHandlerDefinition, FileResource } from "./types";

/**
 * The file handler registry. Module-level singleton by design — DRAGHUB has
 * one registry for the whole desktop, the same way there is one application
 * registry. Extension-specific "what can open this file" logic lives only
 * here; window/render components ask the registry instead of growing their
 * own `if (extension === ...)` chains.
 */
const handlers = new Map<string, FileHandlerDefinition>();

/** Registers a handler, or replaces an existing one with the same id. Safe
 * to call repeatedly (e.g. Next.js Fast Refresh re-evaluating a module). */
export function registerFileHandler(def: FileHandlerDefinition): void {
  handlers.set(def.id, def);
}

export function listFileHandlers(): FileHandlerDefinition[] {
  return [...handlers.values()];
}

export function extensionOf(path: string): string {
  const idx = path.lastIndexOf(".");
  return idx === -1 ? "" : path.slice(idx + 1).toLowerCase();
}

function matchesExtension(def: FileHandlerDefinition, ext: string): boolean {
  return def.extensions.length === 0 || def.extensions.includes(ext);
}

/** Every handler applicable to `resource`, most relevant first (priority
 * descending, then registration order as a stable tiebreaker). */
export function handlersFor(resource: FileResource): FileHandlerDefinition[] {
  const ext = extensionOf(resource.path);
  return [...handlers.values()]
    .map((def, index) => ({ def, index }))
    .filter(({ def }) => matchesExtension(def, ext) && def.canHandle(resource))
    .sort((a, b) => b.def.priority - a.def.priority || a.index - b.index)
    .map(({ def }) => def);
}

/** The single best handler for `resource`, or null if none match. Used to
 * pick a default action (e.g. double-click) without opening a menu. */
export function defaultFileHandler(
  resource: FileResource
): FileHandlerDefinition | null {
  return handlersFor(resource)[0] ?? null;
}

export function handlersForSurface(
  resource: FileResource,
  surface: "inline" | "window"
): FileHandlerDefinition[] {
  return handlersFor(resource).filter((def) => def.surfaces.includes(surface));
}

/** Test hook: clear all registrations so a suite can register its own
 * fixture handlers without inheriting the real desktop's defaults. */
export function __resetFileHandlersForTests(): void {
  handlers.clear();
}
