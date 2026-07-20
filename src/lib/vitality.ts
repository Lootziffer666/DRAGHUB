import { ghRequest } from "./github";

export type Vitality = { lastCommitAt: string | null; ageDays: number | null; level: "fresh" | "active" | "stale" | "ancient" | "unknown" };
const cache = new Map<string, Vitality>();

export async function fetchVitality(owner: string, repo: string, branch: string, path: string): Promise<Vitality> {
  const key = `${owner}/${repo}@${branch}:${path}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const res = await ghRequest(`/repos/${owner}/${repo}/commits?sha=${encodeURIComponent(branch)}&path=${encodeURIComponent(path)}&per_page=1`);
  if (!res.ok) return remember(key, { lastCommitAt: null, ageDays: null, level: "unknown" });
  const data = await res.json<Array<{ commit?: { committer?: { date?: string } } }>>();
  const date = data[0]?.commit?.committer?.date ?? null;
  if (!date) return remember(key, { lastCommitAt: null, ageDays: null, level: "unknown" });
  const ageDays = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000));
  const level = ageDays < 14 ? "fresh" : ageDays < 90 ? "active" : ageDays < 365 ? "stale" : "ancient";
  return remember(key, { lastCommitAt: date, ageDays, level });
}

function remember(key: string, value: Vitality): Vitality { cache.set(key, value); return value; }
