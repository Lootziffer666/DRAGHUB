import { getGithubToken } from "./github";

export type LfsPointer = { oid: string; size: number };

const LFS_PREFIX = "version https://git-lfs.github.com/spec/v1";

export function parseLfsPointer(content: string | undefined): LfsPointer | null {
  if (!content?.startsWith(LFS_PREFIX)) return null;
  const oid = content.match(/^oid sha256:([a-f0-9]{64})$/m)?.[1];
  const size = Number(content.match(/^size (\d+)$/m)?.[1] ?? "NaN");
  if (!oid || !Number.isFinite(size)) return null;
  return { oid, size };
}

export async function downloadLfsObject(
  owner: string,
  repo: string,
  pointer: LfsPointer,
  onProgress?: (loaded: number, total: number) => void
): Promise<Blob> {
  const token = getGithubToken();
  const endpoint = `https://github.com/${owner}/${repo}.git/info/lfs`;
  const batchRes = await fetch(`${endpoint}/objects/batch`, {
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
  if (!batchRes.ok) throw new Error(`LFS batch download failed (${batchRes.status}).`);
  const batch = (await batchRes.json()) as {
    objects: Array<{ error?: { message: string }; actions?: { download?: { href: string; header?: Record<string, string> } } }>;
  };
  const obj = batch.objects[0];
  if (!obj) throw new Error("LFS batch response missing object.");
  if (obj.error) throw new Error(`LFS error: ${obj.error.message}`);
  const action = obj.actions?.download;
  if (!action) throw new Error("LFS download action unavailable.");
  const res = await fetch(action.href, { headers: action.header });
  if (!res.ok) throw new Error(`LFS object download failed (${res.status}).`);
  const reader = res.body?.getReader();
  if (!reader) return await res.blob();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      loaded += value.byteLength;
      onProgress?.(loaded, pointer.size);
    }
  }
  return new Blob(chunks.map((chunk) => chunk.slice().buffer));
}
