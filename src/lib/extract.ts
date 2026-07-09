import JSZip from "jszip";

export type ExtractedFile = {
  path: string;
  data: Uint8Array;
};

export type ArchiveKind = "zip" | "7z" | "rar";

export function archiveKind(name: string): ArchiveKind | null {
  const lower = name.toLowerCase();
  if (lower.endsWith(".zip")) return "zip";
  if (lower.endsWith(".7z")) return "7z";
  if (lower.endsWith(".rar")) return "rar";
  return null;
}

/**
 * Extract a zip / 7z / rar archive entirely in the browser.
 * zip is handled by JSZip; 7z and rar by libarchive.js (WASM).
 */
export async function extractArchive(file: File): Promise<ExtractedFile[]> {
  const kind = archiveKind(file.name);
  if (!kind) throw new Error(`Unsupported archive: ${file.name}`);
  if (kind === "zip") return extractZip(file);
  return extractWithLibarchive(file);
}

async function extractZip(file: File): Promise<ExtractedFile[]> {
  const buf = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buf);
  const out: ExtractedFile[] = [];
  const entries = Object.values(zip.files);
  for (const entry of entries) {
    if (entry.dir) continue;
    const data = await entry.async("uint8array");
    out.push({ path: normalizePath(entry.name), data });
  }
  return out;
}

// libarchive.js ships types, but the default export's shape is awkward to
// satisfy across versions, so we describe just what we use.
type LibarchiveFile = { path: string; file: Blob };
type LibarchiveArchive = {
  extractFiles: () => Promise<LibarchiveFile[]>;
  close: () => Promise<void>;
};
type LibarchiveModule = {
  init: (opts: { workerUrl: string; wasmUrl: string }) => void;
  open: (file: File) => Promise<LibarchiveArchive>;
};

async function extractWithLibarchive(file: File): Promise<ExtractedFile[]> {
  const mod = (await import("libarchive.js")) as unknown as {
    default: LibarchiveModule;
  };
  const Archive = mod.default;
  Archive.init({
    workerUrl:
      "https://unpkg.com/libarchive.js@2.0.2/dist/worker-bundle.js",
    wasmUrl: "https://unpkg.com/libarchive.js@2.0.2/dist/libarchive.wasm",
  });
  const archive = await Archive.open(file);
  const extracted = await archive.extractFiles();
  await archive.close();

  const out: ExtractedFile[] = [];
  for (const item of extracted) {
    const path = normalizePath(item.path);
    if (!path || path.endsWith("/")) continue;
    const blob: Blob | undefined =
      item.file instanceof Blob ? item.file : undefined;
    if (!blob) continue;
    const buf = await blob.arrayBuffer();
    out.push({ path, data: new Uint8Array(buf) });
  }
  return out;
}

function normalizePath(p: string): string {
  return p
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
}
