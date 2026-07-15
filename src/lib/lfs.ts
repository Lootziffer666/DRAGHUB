import { getGithubToken } from "./github";
import { fetchGitAttributes } from "./github-write";

export type LfsPointer = { oid: string; size: number };

const LFS_PREFIX = "version https://git-lfs.github.com/spec/v1";

/** Detects a Git LFS pointer file by its well-known content prefix. */
export function parseLfsPointer(content: string): LfsPointer | null {
  if (!content.startsWith(LFS_PREFIX)) return null;
  const oidMatch = content.match(/oid sha256:([0-9a-f]{64})/);
  const sizeMatch = content.match(/size (\d+)/);
  if (!oidMatch || !sizeMatch) return null;
  return { oid: oidMatch[1], size: Number(sizeMatch[1]) };
}

/** Converts a `.gitattributes` `filter=lfs` glob (e.g. `*.psd`) to a RegExp. */
function globToRegExp(glob: string): RegExp {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp(`(^|/)${escaped}$`, "i");
}

/**
 * Cheap, cache-friendly heuristic for "this file is probably tracked by
 * LFS" — reads `.gitattributes` once per (repo, branch) instead of fetching
 * every file's content just to check. Confirmed on open via parseLfsPointer.
 */
export async function fetchLfsPatterns(
  owner: string,
  repo: string,
  branch: string
): Promise<RegExp[]> {
  const text = await fetchGitAttributes(owner, repo, branch);
  const patterns: RegExp[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const [pattern, ...attrs] = trimmed.split(/\s+/);
    if (attrs.some((a) => a === "filter=lfs")) {
      patterns.push(globToRegExp(pattern));
    }
  }
  return patterns;
}

export function matchesLfsPattern(path: string, patterns: RegExp[]): boolean {
  return patterns.some((re) => re.test(path));
}

async function resolveLfsDownload(
  owner: string,
  repo: string,
  pointer: LfsPointer
): Promise<{ href: string; header?: Record<string, string> }> {
  const token = getGithubToken();
  const endpoint = `https://github.com/${owner}/${repo}.git/info/lfs`;
  const res = await fetch(`${endpoint}/objects/batch`, {
    method: "POST",
    headers: {
      Accept: "application/vnd.git-lfs+json",
      "Content-Type": "application/vnd.git-lfs+json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      operation: "download",
      transfers: ["basic"],
      objects: [{ oid: pointer.oid, size: pointer.size }],
    }),
  });
  if (!res.ok) throw new Error(`LFS batch request failed (${res.status}).`);
  const batch = (await res.json()) as {
    objects: Array<{
      oid: string;
      error?: { message: string };
      actions?: { download?: { href: string; header?: Record<string, string> } };
    }>;
  };
  const obj = batch.objects?.[0];
  if (!obj) throw new Error("LFS batch response missing object.");
  if (obj.error) throw new Error(`LFS error: ${obj.error.message}`);
  if (!obj.actions?.download) throw new Error("LFS download action unavailable.");
  return obj.actions.download;
}

/** Downloads an LFS object's real bytes, with optional progress reporting. */
export async function downloadLfsObject(
  owner: string,
  repo: string,
  pointer: LfsPointer,
  onProgress?: (loaded: number, total: number) => void
): Promise<Uint8Array> {
  const download = await resolveLfsDownload(owner, repo, pointer);
  const res = await fetch(download.href, { headers: download.header });
  if (!res.ok) throw new Error(`LFS object download failed (${res.status}).`);

  if (!res.body || !onProgress) {
    return new Uint8Array(await res.arrayBuffer());
  }

  const total = Number(res.headers.get("content-length")) || pointer.size;
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.byteLength;
    onProgress(loaded, total);
  }
  const result = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}
