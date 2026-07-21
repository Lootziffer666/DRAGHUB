import { extensionOf, registerFileHandler } from "./registry";
import type { FileResource } from "./types";

export const IMAGE_EXTENSIONS = [
  "png",
  "jpg",
  "jpeg",
  "gif",
  "svg",
  "webp",
  "ico",
  "bmp",
  "avif",
];

export const AUDIO_EXTENSIONS = [
  "mp3",
  "wav",
  "ogg",
  "oga",
  "m4a",
  "flac",
  "aac",
  "opus",
  "weba",
];

export const MARKDOWN_EXTENSIONS = ["md", "mdx"];

// Extensions no generic text handler (Code Editor, Raw Text) should claim —
// they are binary or have a dedicated handler already. Archive formats are
// listed here too even though there is no archive handler yet (§4 of the
// DaedalOS extension plan): until one exists they should fall through to
// Download, never to a text editor.
const NON_TEXT_EXTENSIONS = new Set([
  ...IMAGE_EXTENSIONS,
  ...AUDIO_EXTENSIONS,
  "zip",
  "7z",
  "rar",
  "tar",
  "gz",
]);

function isNonText(resource: FileResource): boolean {
  return NON_TEXT_EXTENSIONS.has(extensionOf(resource.path));
}

/**
 * Registers the handlers DRAGHUB ships today. Idempotent — `registerFileHandler`
 * upserts by id, so calling this repeatedly (Fast Refresh, tests resetting
 * the registry between cases) is always safe and cheap.
 */
export function registerDefaultFileHandlers(): void {
  registerFileHandler({
    id: "code-editor",
    title: "Code Editor",
    applicationId: "file-editor",
    extensions: [],
    surfaces: ["window"],
    priority: 10,
    canHandle: (resource) => !isNonText(resource),
  });

  registerFileHandler({
    id: "image-viewer",
    title: "Image Viewer",
    applicationId: "image-viewer",
    extensions: IMAGE_EXTENSIONS,
    surfaces: ["window", "inline"],
    priority: 30,
    canHandle: () => true,
  });

  registerFileHandler({
    id: "markdown-preview",
    title: "Markdown Preview",
    applicationId: "image-viewer",
    extensions: MARKDOWN_EXTENSIONS,
    surfaces: ["window", "inline"],
    priority: 30,
    canHandle: () => true,
  });

  registerFileHandler({
    id: "raw-text",
    title: "Raw Text",
    applicationId: "raw-text-viewer",
    extensions: [],
    surfaces: ["window"],
    priority: 10,
    canHandle: (resource) => !isNonText(resource),
  });

  registerFileHandler({
    id: "audio-player",
    title: "Audio Player",
    applicationId: "audio-player",
    extensions: AUDIO_EXTENSIONS,
    surfaces: ["window"],
    priority: 30,
    canHandle: () => true,
  });

  // Sentinel applicationId: the "Open with" menu downloads the authenticated
  // blob directly instead of opening a desktop window for this one.
  registerFileHandler({
    id: "download",
    title: "Download",
    applicationId: "__download__",
    extensions: [],
    surfaces: ["window"],
    priority: 0,
    canHandle: () => true,
  });
}
