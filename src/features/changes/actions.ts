import type { OverlayEntry } from "./overlay";

export function promptNewName(kind: "file" | "folder"): string | null {
  const raw = window.prompt(`New ${kind} name:`);
  if (raw === null) return null;
  const name = raw.trim().replace(/^\/+|\/+$/g, "");
  if (!name) return null;
  return name;
}

export function promptRename(currentName: string): string | null {
  const raw = window.prompt("Rename to:", currentName);
  if (raw === null) return null;
  const name = raw.trim().replace(/^\/+|\/+$/g, "");
  if (!name || name === currentName) return null;
  return name;
}

export function nameCollides(dirEntries: OverlayEntry[], name: string): boolean {
  return dirEntries.some((e) => e.name.toLowerCase() === name.toLowerCase());
}
