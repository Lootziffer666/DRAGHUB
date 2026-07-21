import type { ComponentType, SVGProps } from "react";
import {
  DocumentRegular,
  DocumentTextRegular,
  FolderFilled,
  FolderOpenFilled,
  FolderZipRegular,
  ImageFilled,
  MarkdownRegular,
  MusicNote2Filled,
} from "./fluent-icons";

export type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

export type FileIconKey =
  | "folder"
  | "folder-open"
  | "file"
  | "code"
  | "image"
  | "audio"
  | "markdown"
  | "archive";

const fileIcons: Record<FileIconKey, IconComponent> = {
  folder: FolderFilled,
  "folder-open": FolderOpenFilled,
  file: DocumentRegular,
  code: DocumentTextRegular,
  image: ImageFilled,
  audio: MusicNote2Filled,
  markdown: MarkdownRegular,
  archive: FolderZipRegular,
};

const IMAGE_EXT = new Set(["png", "jpg", "jpeg", "gif", "svg", "webp", "ico", "bmp", "avif"]);
const AUDIO_EXT = new Set(["mp3", "wav", "ogg", "oga", "m4a", "flac", "aac", "opus", "weba"]);
const MARKDOWN_EXT = new Set(["md", "mdx"]);
const TEXT_EXT = new Set(["txt", "rst", "log"]);
const ARCHIVE_EXT = new Set(["zip", "7z", "rar", "tar", "gz"]);

export function fileIconKeyForPath(name: string): FileIconKey {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (IMAGE_EXT.has(ext)) return "image";
  if (AUDIO_EXT.has(ext)) return "audio";
  if (MARKDOWN_EXT.has(ext)) return "markdown";
  if (ARCHIVE_EXT.has(ext)) return "archive";
  if (TEXT_EXT.has(ext)) return "file";
  return "code";
}

/** Resolves a semantic file-type key to its icon component. */
export function resolveFileIcon(key: FileIconKey): IconComponent {
  return fileIcons[key];
}

/** Convenience: resolve directly from a file name/path by extension. */
export function fileIconForPath(name: string): IconComponent {
  return resolveFileIcon(fileIconKeyForPath(name));
}
