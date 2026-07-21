/** The subset of a file resource a handler needs to decide whether it
 * applies and how to render. `size` is optional — callers that only know
 * the path (e.g. a bare Explorer selection) can omit it. */
export type FileResource = {
  repoKey: string;
  path: string;
  size?: number;
};

/**
 * Where a handler is allowed to render:
 * - "inline": inside an existing file surface (a repository window's tab,
 *   another viewer) without opening a new desktop window.
 * - "window": as its own desktop window, opened via the application
 *   registry using `applicationId`.
 */
export type FileHandlerSurface = "inline" | "window";

export interface FileHandlerDefinition {
  /** Stable, unique identifier. Never reused for a different meaning once
   * shipped — it is not currently persisted, but treat it as if it were. */
  id: string;
  /** Human-readable label shown in "Open with" menus. */
  title: string;
  /** Desktop application id this handler opens for the "window" surface.
   * `applicationRegistry` must have an entry for this id. */
  applicationId: string;
  /** Lowercased extensions (no leading dot) this handler declares support
   * for. An empty array means "any extension" — used for fallback handlers
   * and narrowed further by `canHandle`. */
  extensions: string[];
  mimeTypes?: string[];
  surfaces: FileHandlerSurface[];
  /** Higher priority wins when multiple handlers match; ties keep
   * registration order. Used to rank "Open with" menu entries and to pick
   * the default handler for a resource. */
  priority: number;
  /** Final say on whether this handler applies to `resource`, beyond the
   * extension match — e.g. a fallback handler excluding extensions a more
   * specific handler already claims, or a size-based guard. */
  canHandle(resource: FileResource): boolean;
}
