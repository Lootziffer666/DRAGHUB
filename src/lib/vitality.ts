import { fetchLastCommit, type LastCommitInfo } from "./github";

const CACHE_KEY = "gh-browser-vitality-cache";
const STALE_DAYS = 180;

type CacheEntry = { info: LastCommitInfo | null; fetchedAt: number };

function readCache(): Record<string, CacheEntry> {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function writeCache(cache: Record<string, CacheEntry>) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* ignore */
  }
}

function cacheKey(owner: string, repo: string, branch: string, path: string): string {
  return `${owner}/${repo}@${branch}:${path}`;
}

const CACHE_TTL_MS = 30 * 60 * 1000;

/**
 * Lazily fetches (and caches) the last commit touching a path. Deliberately
 * only called for the single currently-open file — fetching this per row for
 * an entire expanded folder would burn the GitHub rate limit fast (§11 Risks).
 */
export async function fetchVitality(
  owner: string,
  repo: string,
  branch: string,
  path: string
): Promise<LastCommitInfo | null> {
  const key = cacheKey(owner, repo, branch, path);
  const cache = readCache();
  const hit = cache[key];
  if (hit && Date.now() - hit.fetchedAt < CACHE_TTL_MS) {
    return hit.info;
  }
  const info = await fetchLastCommit(owner, repo, path, branch);
  cache[key] = { info, fetchedAt: Date.now() };
  writeCache(cache);
  return info;
}

export function daysSince(dateIso: string): number {
  const then = new Date(dateIso).getTime();
  if (Number.isNaN(then)) return NaN;
  return Math.floor((Date.now() - then) / (24 * 60 * 60 * 1000));
}

export function isStale(dateIso: string): boolean {
  const d = daysSince(dateIso);
  return !Number.isNaN(d) && d >= STALE_DAYS;
}

export function formatRelativeDays(dateIso: string): string {
  const d = daysSince(dateIso);
  if (Number.isNaN(d)) return "unknown";
  if (d <= 0) return "today";
  if (d === 1) return "1 day ago";
  if (d < 30) return `${d} days ago`;
  const months = Math.floor(d / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}
