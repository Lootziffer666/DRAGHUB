import { mergeThreeWay, applyResolutions, type MergeResult, type ConflictResolution } from "@/lib/merge";
import { fetchFileAtRef, findMergeBase, filesChangedSince, type CompareFile } from "./compare";

export type FileMergePlan =
  | { path: string; status: "clean"; action: "none" }
  | { path: string; status: "clean"; action: "add" | "modify"; content: string }
  | { path: string; status: "clean"; action: "delete" }
  | {
      path: string;
      status: "conflict";
      kind: "text" | "add-add";
      baseText: string;
      oursText: string;
      theirsText: string;
      mergeResult: MergeResult;
    }
  | {
      path: string;
      status: "conflict";
      kind: "delete-modify";
      deletedBy: "ours" | "theirs";
      baseText: string;
      survivingText: string;
    };

export type MergePreview = {
  mergeBaseSha: string;
  theirsBranch: string;
  plans: FileMergePlan[];
};

async function planFileMerge(
  owner: string,
  repo: string,
  path: string,
  mergeBaseSha: string,
  oursBranch: string,
  theirsBranch: string
): Promise<FileMergePlan> {
  const [baseText, oursText, theirsText] = await Promise.all([
    fetchFileAtRef(owner, repo, path, mergeBaseSha),
    fetchFileAtRef(owner, repo, path, oursBranch),
    fetchFileAtRef(owner, repo, path, theirsBranch),
  ]);

  if (oursText === theirsText) {
    return { path, status: "clean", action: "none" };
  }

  if (baseText === null) {
    if (oursText !== null && theirsText === null) return { path, status: "clean", action: "none" };
    if (oursText === null && theirsText !== null) {
      return { path, status: "clean", action: "add", content: theirsText };
    }
    const mergeResult = mergeThreeWay("", oursText ?? "", theirsText ?? "");
    return {
      path,
      status: "conflict",
      kind: "add-add",
      baseText: "",
      oursText: oursText ?? "",
      theirsText: theirsText ?? "",
      mergeResult,
    };
  }

  if (oursText === null) {
    if (theirsText === baseText) return { path, status: "clean", action: "none" };
    return {
      path,
      status: "conflict",
      kind: "delete-modify",
      deletedBy: "ours",
      baseText,
      survivingText: theirsText ?? "",
    };
  }

  if (theirsText === null) {
    if (oursText === baseText) return { path, status: "clean", action: "delete" };
    return {
      path,
      status: "conflict",
      kind: "delete-modify",
      deletedBy: "theirs",
      baseText,
      survivingText: oursText,
    };
  }

  const mergeResult = mergeThreeWay(baseText, oursText, theirsText);
  if (!mergeResult.hasConflict) {
    return { path, status: "clean", action: "modify", content: applyResolutions(mergeResult.hunks, []) };
  }
  return { path, status: "conflict", kind: "text", baseText, oursText, theirsText, mergeResult };
}

/**
 * Plans a merge of `theirsBranch` into `oursBranch`: finds the true merge
 * base, then for every path either side touched since it, runs a 3-way
 * merge. Files neither side changed relative to the merge base never show
 * up here — nothing to reconcile.
 */
export async function planMerge(
  owner: string,
  repo: string,
  oursBranch: string,
  theirsBranch: string,
  onProgress?: (done: number, total: number) => void
): Promise<MergePreview> {
  const { mergeBaseSha, theirsFiles } = await findMergeBase(owner, repo, oursBranch, theirsBranch);
  const oursFiles = await filesChangedSince(owner, repo, mergeBaseSha, oursBranch);

  const paths = new Set<string>();
  for (const f of theirsFiles) paths.add(f.filename);
  for (const f of oursFiles) paths.add(f.filename);

  const pathList = Array.from(paths);
  const plans: FileMergePlan[] = [];
  let done = 0;
  for (const path of pathList) {
    plans.push(await planFileMerge(owner, repo, path, mergeBaseSha, oursBranch, theirsBranch));
    done++;
    onProgress?.(done, pathList.length);
  }

  return { mergeBaseSha, theirsBranch, plans };
}

export function resolvedTextFor(plan: FileMergePlan, resolutions: ConflictResolution[]): string {
  if (plan.status !== "conflict") throw new Error("resolvedTextFor called on a clean plan.");
  if (plan.kind === "delete-modify") return plan.survivingText;
  return applyResolutions(plan.mergeResult.hunks, resolutions);
}

export function conflictCountFor(plan: FileMergePlan): number {
  if (plan.status !== "conflict") return 0;
  if (plan.kind === "delete-modify") return 1;
  return plan.mergeResult.hunks.filter((h) => h.kind === "conflict").length;
}

export type { CompareFile };
