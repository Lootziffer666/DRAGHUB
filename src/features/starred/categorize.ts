import { chatComplete, textHash } from "@/lib/ai";
import type { StarredRepo } from "./api";

const STORAGE_KEY = "draghub-starred-categories";
const BATCH_SIZE = 20;

type CachedCategory = { category: string; sourceHash: string };

function readCache(): Record<string, CachedCategory> {
  if (typeof localStorage === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function writeCache(cache: Record<string, CachedCategory>): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
}

/** The text a category is derived from — a category is stale the moment
 * any of this changes for a repo. */
export function categorySourceText(repo: StarredRepo): string {
  return [repo.fullName, repo.description ?? "", repo.language ?? ""].join("::");
}

/** Every repo's currently cached category, keyed by full_name. Repos whose
 * cached category no longer matches their current source text (edited
 * description, etc.) are omitted — they read as uncategorized until
 * recategorized, rather than showing a stale label silently. */
export function loadCategories(repos: StarredRepo[]): Record<string, string> {
  const cache = readCache();
  const out: Record<string, string> = {};
  for (const repo of repos) {
    const entry = cache[repo.fullName];
    if (entry && entry.sourceHash === textHash(categorySourceText(repo))) {
      out[repo.fullName] = entry.category;
    }
  }
  return out;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Categorizes repos with AI, reusing already-assigned category names where
 * they fit (kept in the prompt) instead of inventing a fresh label per
 * batch — the taxonomy should converge rather than sprawl. Batched to keep
 * request count/cost sane for large star lists; a batch failing doesn't
 * abort the rest.
 *
 * `force`: recompute even for repos that already have a fresh cached
 * category (the "Recategorize all" action).
 */
export async function categorizeRepos(
  repos: StarredRepo[],
  opts: { force?: boolean; onProgress?: (done: number, total: number) => void } = {}
): Promise<Record<string, string>> {
  const cache = readCache();
  const existing = loadCategories(repos);
  const targets = opts.force
    ? repos
    : repos.filter((r) => !(r.fullName in existing));

  const result: Record<string, string> = { ...existing };
  if (targets.length === 0) return result;

  let done = 0;
  for (const batch of chunk(targets, BATCH_SIZE)) {
    const knownCategories = [...new Set(Object.values(result))].slice(0, 40);
    const list = batch
      .map(
        (r, i) =>
          `${i + 1}. ${r.fullName} — language: ${r.language ?? "unknown"} — ${
            r.description ? r.description.slice(0, 200) : "(no description)"
          }`
      )
      .join("\n");
    const prompt = [
      "Assign exactly one short category (1-3 words, Title Case, e.g. \"Web Framework\", \"CLI Tool\", \"Machine Learning\") to each GitHub repository below.",
      knownCategories.length > 0
        ? `Reuse one of these existing categories whenever it genuinely fits, to keep the set small: ${knownCategories.join(", ")}.`
        : "",
      "Only introduce a new category when none of the existing ones fit.",
      "Respond with ONLY a JSON object mapping the exact repository full name to its category string — no prose, no markdown fences.",
      "",
      list,
    ]
      .filter(Boolean)
      .join("\n");

    try {
      const response = await chatComplete([
        {
          role: "system",
          content:
            "You are a precise repository taxonomist. You always respond with strict JSON and nothing else.",
        },
        { role: "user", content: prompt },
      ]);
      const parsed = parseCategoryResponse(response);
      for (const repo of batch) {
        const category = parsed[repo.fullName];
        if (!category) continue;
        result[repo.fullName] = category;
        cache[repo.fullName] = {
          category,
          sourceHash: textHash(categorySourceText(repo)),
        };
      }
      writeCache(cache);
    } catch {
      // One batch failing (rate limit, transient network error) doesn't
      // abort the rest — the caller sees partial results and can retry.
    }
    done += batch.length;
    opts.onProgress?.(Math.min(done, targets.length), targets.length);
  }

  return result;
}

export function parseCategoryResponse(text: string): Record<string, string> {
  // Models occasionally wrap JSON in a markdown fence despite instructions
  // not to — strip it rather than failing the whole batch over formatting.
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  try {
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "string" && value.trim()) out[key] = value.trim();
    }
    return out;
  } catch {
    return {};
  }
}
