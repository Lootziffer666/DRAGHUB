import { ghRequest } from "@/lib/github";

export type CompareFileStatus =
  | "added"
  | "removed"
  | "modified"
  | "renamed"
  | "copied"
  | "changed"
  | "unchanged";

export type CompareFile = { filename: string; status: CompareFileStatus };

type CompareResponse = {
  merge_base_commit: { sha: string };
  files?: CompareFile[];
};

async function compare(
  owner: string,
  repo: string,
  base: string,
  head: string
): Promise<CompareResponse> {
  const res = await ghRequest(
    `/repos/${owner}/${repo}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`
  );
  if (!res.ok) {
    throw new Error(`Failed to compare "${base}...${head}" (${res.status}).`);
  }
  return res.json<CompareResponse>();
}

/** Finds the true merge-base commit and everything `theirs` changed since it. */
export async function findMergeBase(
  owner: string,
  repo: string,
  ours: string,
  theirs: string
): Promise<{ mergeBaseSha: string; theirsFiles: CompareFile[] }> {
  const data = await compare(owner, repo, ours, theirs);
  return { mergeBaseSha: data.merge_base_commit.sha, theirsFiles: data.files ?? [] };
}

/** Everything `branch` changed since `mergeBaseSha`. */
export async function filesChangedSince(
  owner: string,
  repo: string,
  mergeBaseSha: string,
  branch: string
): Promise<CompareFile[]> {
  const data = await compare(owner, repo, mergeBaseSha, branch);
  return data.files ?? [];
}

/** File content at an arbitrary ref/sha, or null if the file doesn't exist there. */
export async function fetchFileAtRef(
  owner: string,
  repo: string,
  path: string,
  ref: string
): Promise<string | null> {
  const res = await ghRequest(
    `/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(ref)}`
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Failed to load "${path}" at ${ref} (${res.status}).`);
  }
  const data = await res.json<{ content: string; encoding: string }>();
  if (data.encoding === "base64") {
    const binary = atob(data.content.replace(/\s/g, ""));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  }
  return data.content;
}
