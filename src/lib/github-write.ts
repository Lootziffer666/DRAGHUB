import { ghRequest, getGithubToken } from "./github";

export type CommitFile = {
  path: string;
  data: Uint8Array;
  /** Force Git LFS storage for this file regardless of size. */
  forceLfs?: boolean;
};

export type CommitProgress = {
  phase: "preparing" | "uploading" | "committing" | "done" | "error";
  committedFiles: number;
  totalFiles: number;
  currentCommit: number;
  totalCommits: number;
  message?: string;
};

export type CommitOptions = {
  owner: string;
  repo: string;
  branch: string;
  message: string;
  /** Soft cap for the number of files per commit. */
  maxFilesPerCommit?: number;
  /** Soft cap for the total byte size per commit. */
  maxBytesPerCommit?: number;
  /** Enable Git LFS for files at/above the threshold or marked forceLfs. */
  useLfs?: boolean;
  /** Files at/above this size are stored via LFS when useLfs is enabled. */
  lfsThresholdBytes?: number;
  /** Patterns written into .gitattributes when LFS is enabled. */
  lfsPatterns?: string[];
  onProgress?: (p: CommitProgress) => void;
};

export type CommitResult = {
  ok: boolean;
  commits: number;
  files: number;
  errors: string[];
  failedFiles: string[];
};

const DEFAULT_MAX_FILES = 100;
const DEFAULT_MAX_BYTES = 25 * 1024 * 1024;
const DEFAULT_LFS_THRESHOLD = 50 * 1024 * 1024;
const GITHUB_BLOB_LIMIT = 100 * 1024 * 1024;

type Batch = CommitFile[];

/**
 * Push a set of files to a branch. Large change-sets are automatically split
 * into multiple commits. Files at/above the LFS threshold (or marked
 * forceLfs) are stored via Git LFS.
 */
export async function commitFiles(
  files: CommitFile[],
  opts: CommitOptions
): Promise<CommitResult> {
  const maxFiles = opts.maxFilesPerCommit ?? DEFAULT_MAX_FILES;
  const maxBytes = opts.maxBytesPerCommit ?? DEFAULT_MAX_BYTES;
  const lfsThreshold = opts.lfsThresholdBytes ?? DEFAULT_LFS_THRESHOLD;
  const useLfs = Boolean(opts.useLfs);

  const result: CommitResult = {
    ok: true,
    commits: 0,
    files: 0,
    errors: [],
    failedFiles: [],
  };

  const valid = files
    .filter((f) => f.path && f.path.length > 0)
    .map((f) => ({ ...f, path: f.path.replace(/^\/+/, "") }));

  if (valid.length === 0) {
    return { ...result, errors: ["No files to commit."] };
  }

  const batches = splitBatches(valid, maxFiles, maxBytes);
  const totalCommits = batches.length;
  const totalFiles = valid.length;

  let baseSha = await resolveBaseSha(opts.owner, opts.repo, opts.branch);

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    opts.onProgress?.({
      phase: "uploading",
      committedFiles: result.files,
      totalFiles,
      currentCommit: i + 1,
      totalCommits,
      message: `Uploading batch ${i + 1}/${totalCommits}…`,
    });

    try {
      const newSha = await commitBatch(batch, {
        ...opts,
        useLfs,
        lfsThreshold,
        baseSha,
        isFirst: i === 0,
      });
      baseSha = newSha;
      result.commits += 1;
      result.files += batch.length;
      opts.onProgress?.({
        phase: "committing",
        committedFiles: result.files,
        totalFiles,
        currentCommit: i + 1,
        totalCommits,
        message: `Committed batch ${i + 1}/${totalCommits}.`,
      });
    } catch (err) {
      result.ok = false;
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`Batch ${i + 1}/${totalCommits} failed: ${msg}`);
      for (const f of batch) result.failedFiles.push(f.path);
      break;
    }
  }

  opts.onProgress?.({
    phase: result.ok ? "done" : "error",
    committedFiles: result.files,
    totalFiles,
    currentCommit: totalCommits,
    totalCommits,
  });

  return result;
}

function splitBatches(files: CommitFile[], maxFiles: number, maxBytes: number): Batch[] {
  const batches: Batch[] = [];
  let current: Batch = [];
  let currentBytes = 0;
  for (const f of files) {
    const size = f.data.byteLength;
    if (
      current.length > 0 &&
      (current.length >= maxFiles || currentBytes + size > maxBytes)
    ) {
      batches.push(current);
      current = [];
      currentBytes = 0;
    }
    current.push(f);
    currentBytes += size;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

type BatchOpts = CommitOptions & {
  useLfs: boolean;
  lfsThreshold: number;
  baseSha: string;
  isFirst: boolean;
};

async function commitBatch(
  batch: Batch,
  opts: BatchOpts
): Promise<string> {
  const { owner, repo, branch, message, useLfs, lfsThreshold, baseSha, isFirst } =
    opts;

  const treeEntries: Array<{
    path: string;
    mode: "100644" | "100755";
    type: "blob";
    sha: string;
  }> = [];

  const lfsPatterns = new Set<string>();

  for (const f of batch) {
    const storeAsLfs = useLfs && (f.forceLfs || f.data.byteLength >= lfsThreshold);
    if (!storeAsLfs && f.data.byteLength > GITHUB_BLOB_LIMIT) {
      throw new Error(
        `File ${f.path} is ${formatBytes(f.data.byteLength)} which exceeds the ` +
          `GitHub blob limit of 100 MB. Enable LFS to store it.`
      );
    }

    let sha: string;
    if (storeAsLfs) {
      const pattern = lfsPatternFor(f.path);
      if (pattern) lfsPatterns.add(pattern);
      const pointer = await uploadLfsObject(owner, repo, f);
      sha = await createBlob(owner, repo, pointer);
    } else {
      sha = await createBlob(owner, repo, f.data);
    }
    treeEntries.push({
      path: f.path,
      mode: isExecutable(f.path) ? "100755" : "100644",
      type: "blob",
      sha,
    });
  }

  if (lfsPatterns.size > 0) {
    const attrs = await buildGitAttributes(
      owner,
      repo,
      branch,
      Array.from(lfsPatterns)
    );
    const attrsSha = await createBlob(owner, repo, attrs);
    treeEntries.push({
      path: ".gitattributes",
      mode: "100644",
      type: "blob",
      sha: attrsSha,
    });
  }

  const tree = await createTree(owner, repo, baseSha, treeEntries);
  const commit = await createCommit(owner, repo, message, tree, baseSha);
  await updateRef(owner, repo, branch, commit);
  return commit;
}

async function createBlob(
  owner: string,
  repo: string,
  content: Uint8Array | string
): Promise<string> {
  const body =
    typeof content === "string"
      ? { content, encoding: "utf-8" }
      : { content: toBase64(content), encoding: "base64" };
  const res = await ghRequest(`/repos/${owner}/${repo}/git/blobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Failed to create blob (${res.status}).`);
  }
  const data = await res.json<{ sha: string }>();
  return data.sha;
}

async function createTree(
  owner: string,
  repo: string,
  baseSha: string,
  entries: Array<{ path: string; mode: string; type: string; sha: string | null }>
): Promise<string> {
  const res = await ghRequest(`/repos/${owner}/${repo}/git/trees`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ base_tree: baseSha, tree: entries }),
  });
  if (!res.ok) {
    throw new Error(`Failed to create tree (${res.status}).`);
  }
  const data = await res.json<{ sha: string }>();
  return data.sha;
}

async function createCommit(
  owner: string,
  repo: string,
  message: string,
  tree: string,
  parent: string
): Promise<string> {
  const res = await ghRequest(`/repos/${owner}/${repo}/git/commits`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, tree, parents: [parent] }),
  });
  if (!res.ok) {
    throw new Error(`Failed to create commit (${res.status}).`);
  }
  const data = await res.json<{ sha: string }>();
  return data.sha;
}

async function updateRef(
  owner: string,
  repo: string,
  branch: string,
  sha: string
): Promise<void> {
  const ref = branch.split("/").map(encodeURIComponent).join("/");
  const res = await ghRequest(`/repos/${owner}/${repo}/git/refs/heads/${ref}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sha, force: false }),
  });
  if (!res.ok) {
    throw new Error(`Failed to update branch ref (${res.status}).`);
  }
}

async function resolveBaseSha(
  owner: string,
  repo: string,
  branch: string
): Promise<string> {
  const ref = branch.split("/").map(encodeURIComponent).join("/");
  const res = await ghRequest(`/repos/${owner}/${repo}/git/refs/heads/${ref}`);
  if (res.ok) {
    const data = await res.json<{ object: { sha: string } }>();
    return data.object.sha;
  }
  if (res.status === 404) {
    const meta = await ghRequest(`/repos/${owner}/${repo}`);
    if (meta.ok) {
      const data = await meta.json<{ default_branch: string }>();
      const baseRef = data.default_branch
        .split("/")
        .map(encodeURIComponent)
        .join("/");
      const head = await ghRequest(
        `/repos/${owner}/${repo}/git/refs/heads/${baseRef}`
      );
      if (head.ok) {
        const hd = await head.json<{ object: { sha: string } }>();
        await createRef(owner, repo, branch, hd.object.sha);
        return hd.object.sha;
      }
    }
    throw new Error(`Branch "${branch}" does not exist.`);
  }
  throw new Error(`Failed to resolve branch "${branch}" (${res.status}).`);
}

async function createRef(
  owner: string,
  repo: string,
  branch: string,
  sha: string
): Promise<void> {
  const ref = branch.split("/").map(encodeURIComponent).join("/");
  const res = await ghRequest(`/repos/${owner}/${repo}/git/refs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ref: `refs/heads/${ref}`, sha }),
  });
  if (!res.ok) {
    throw new Error(`Failed to create branch "${branch}" (${res.status}).`);
  }
}

async function uploadLfsObject(
  owner: string,
  repo: string,
  file: CommitFile
): Promise<string> {
  const token = getGithubToken();
  const oid = await sha256Hex(file.data);
  const size = file.data.byteLength;
  const endpoint = `https://github.com/${owner}/${repo}.git/info/lfs`;

  const batchRes = await fetch(`${endpoint}/objects/batch`, {
    method: "POST",
    headers: {
      Accept: "application/vnd.git-lfs+json",
      "Content-Type": "application/vnd.git-lfs+json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      operation: "upload",
      transfers: ["basic"],
      objects: [{ oid, size }],
    }),
  });
  if (!batchRes.ok) {
    throw new Error(`LFS batch request failed (${batchRes.status}).`);
  }
  const batch = (await batchRes.json()) as {
    objects: Array<{
      oid: string;
      error?: { message: string };
      actions?: {
        upload?: { href: string; header?: Record<string, string> };
        verify?: { href: string; header?: Record<string, string> };
      };
    }>;
  };

  const obj = batch.objects[0];
  if (!obj) throw new Error("LFS batch response missing object.");
  if (obj.error) throw new Error(`LFS error: ${obj.error.message}`);
  if (!obj.actions?.upload) throw new Error("LFS upload action unavailable.");

  const upload = obj.actions.upload;
  const put = await fetch(upload.href, {
    method: "PUT",
    headers: { "Content-Type": "application/octet-stream", ...upload.header },
    body: file.data as BodyInit,
  });
  if (!put.ok) {
    throw new Error(`LFS object upload failed (${put.status}).`);
  }
  if (obj.actions.verify) {
    const verify = obj.actions.verify;
    await fetch(verify.href, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...verify.header },
      body: JSON.stringify({ oid, size }),
    });
  }

  return buildLfsPointer(oid, size);
}

function buildLfsPointer(oid: string, size: number): string {
  return [
    "version https://git-lfs.github.com/spec/v1",
    `oid sha256:${oid}`,
    `size ${size}`,
    "",
  ].join("\n");
}

function lfsPatternFor(path: string): string | null {
  const name = path.split("/").pop() ?? path;
  const dot = name.lastIndexOf(".");
  if (dot > 0) return `*${name.slice(dot)}`.toLowerCase();
  return null;
}

async function buildGitAttributes(
  owner: string,
  repo: string,
  branch: string,
  patterns: string[]
): Promise<string> {
  const existing = await fetchGitAttributes(owner, repo, branch);
  const lines = new Set<string>(
    existing
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
  );
  for (const p of patterns) {
    lines.add(`${p} filter=lfs diff=lfs merge=lfs -text`);
  }
  return Array.from(lines).sort().join("\n") + "\n";
}

export async function fetchGitAttributes(
  owner: string,
  repo: string,
  branch: string
): Promise<string> {
  const res = await ghRequest(
    `/repos/${owner}/${repo}/contents/.gitattributes?ref=${encodeURIComponent(branch)}`
  );
  if (!res.ok) return "";
  try {
    const data = await res.json<{ content: string; encoding: string }>();
    if (data.encoding === "base64") return decodeBase64(data.content);
  } catch {
    /* ignore */
  }
  return "";
}

function isExecutable(path: string): boolean {
  return /\.(sh|bash|zsh|py|pl|rb|run)$/i.test(path);
}

async function sha256Hex(data: Uint8Array): Promise<string> {
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  const buf = await crypto.subtle.digest("SHA-256", copy);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + chunk)) as unknown as number[]
    );
  }
  return btoa(binary);
}

function decodeBase64(b64: string): string {
  const cleaned = b64.replace(/\s/g, "");
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

export type TreeOpEntry =
  | { path: string; op: "upsert"; data: Uint8Array }
  | { path: string; op: "delete" }
  | { path: string; op: "reuse"; sha: string; mode?: string };

export type ChangesetCommitOptions = {
  owner: string;
  repo: string;
  branch: string;
  message: string;
};

/**
 * Commit an arbitrary set of tree operations (upsert/delete/reuse-by-sha) as
 * a single commit. This is the generalized "single, targeted tree mutation"
 * primitive that Explorer CRUD (new/rename/delete/move) builds on — unlike
 * commitFiles, entries can delete a path (sha: null) or re-point an existing
 * blob sha to a new path without re-uploading its content.
 */
export async function commitChangeset(
  entries: TreeOpEntry[],
  opts: ChangesetCommitOptions
): Promise<string> {
  const { owner, repo, branch, message } = opts;
  if (entries.length === 0) {
    throw new Error("No changes to commit.");
  }

  const baseSha = await resolveBaseSha(owner, repo, branch);

  const treeEntries: Array<{
    path: string;
    mode: "100644" | "100755";
    type: "blob";
    sha: string | null;
  }> = [];

  for (const entry of entries) {
    if (entry.op === "delete") {
      treeEntries.push({ path: entry.path, mode: "100644", type: "blob", sha: null });
    } else if (entry.op === "reuse") {
      treeEntries.push({
        path: entry.path,
        mode: entry.mode === "100755" ? "100755" : "100644",
        type: "blob",
        sha: entry.sha,
      });
    } else {
      if (entry.data.byteLength > GITHUB_BLOB_LIMIT) {
        throw new Error(
          `File ${entry.path} is ${formatBytes(entry.data.byteLength)} which exceeds the ` +
            `GitHub blob limit of 100 MB.`
        );
      }
      const sha = await createBlob(owner, repo, entry.data);
      treeEntries.push({
        path: entry.path,
        mode: isExecutable(entry.path) ? "100755" : "100644",
        type: "blob",
        sha,
      });
    }
  }

  const tree = await createTree(owner, repo, baseSha, treeEntries);
  const commit = await createCommit(owner, repo, message, tree, baseSha);
  await updateRef(owner, repo, branch, commit);
  return commit;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
