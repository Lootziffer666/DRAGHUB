import { dbGet, dbPut } from "@/lib/staging-db";
import { cosineSimilarity, embedTexts, textHash } from "@/lib/ai";
import type { StarredRepo } from "./api";

// Reuses the generic blob KV store already backing Working-Changes drafts
// (src/lib/staging-db.ts) instead of standing up a second IndexedDB
// database for one more small cache — namespaced so an embedding entry can
// never collide with an unrelated blob id.
const KEY_PREFIX = "ai-embed:";

function embeddingKey(fullName: string): string {
  return `${KEY_PREFIX}${fullName}`;
}

/** The text a repo's embedding is derived from — stale the moment any of
 * this changes, the same staleness contract `categorize.ts` uses. */
export function embeddingSourceText(repo: StarredRepo): string {
  return [repo.fullName, repo.description ?? "", repo.language ?? ""].join(" — ");
}

type CachedEmbedding = { sourceHash: string; vector: number[] };

async function readCachedEmbedding(fullName: string): Promise<CachedEmbedding | null> {
  const bytes = await dbGet(embeddingKey(fullName));
  if (!bytes) return null;
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as CachedEmbedding;
  } catch {
    return null;
  }
}

async function writeCachedEmbedding(fullName: string, entry: CachedEmbedding): Promise<void> {
  await dbPut(embeddingKey(fullName), new TextEncoder().encode(JSON.stringify(entry)));
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

const BATCH_SIZE = 50;

/** Ensures every repo has an up-to-date cached embedding, computing and
 * storing only the ones missing or stale. Safe to call before every
 * semantic search — repeat calls after the first are cheap (cache hits). */
export async function ensureEmbeddings(
  repos: StarredRepo[],
  onProgress?: (done: number, total: number) => void
): Promise<void> {
  const stale: StarredRepo[] = [];
  for (const repo of repos) {
    const cached = await readCachedEmbedding(repo.fullName);
    if (!cached || cached.sourceHash !== textHash(embeddingSourceText(repo))) {
      stale.push(repo);
    }
  }
  if (stale.length === 0) {
    onProgress?.(repos.length, repos.length);
    return;
  }

  let done = repos.length - stale.length;
  onProgress?.(done, repos.length);
  for (const batch of chunk(stale, BATCH_SIZE)) {
    const vectors = await embedTexts(batch.map(embeddingSourceText));
    await Promise.all(
      batch.map((repo, i) =>
        vectors[i]
          ? writeCachedEmbedding(repo.fullName, {
              sourceHash: textHash(embeddingSourceText(repo)),
              vector: vectors[i],
            })
          : Promise.resolve()
      )
    );
    done += batch.length;
    onProgress?.(Math.min(done, repos.length), repos.length);
  }
}

export type RankedRepo = { repo: StarredRepo; score: number };

/**
 * Ranks `repos` by semantic similarity to `query`. Ensures embeddings exist
 * first (computing any missing ones), then compares against a single query
 * embedding — pure client-side kNN, no vector database needed at the scale
 * of one user's starred repos (hundreds, not millions).
 */
export async function semanticRank(
  repos: StarredRepo[],
  query: string,
  onProgress?: (done: number, total: number) => void
): Promise<RankedRepo[]> {
  await ensureEmbeddings(repos, onProgress);
  const [queryVector] = await embedTexts([query]);
  if (!queryVector) return [];

  const ranked: RankedRepo[] = [];
  for (const repo of repos) {
    const cached = await readCachedEmbedding(repo.fullName);
    if (!cached) continue;
    ranked.push({ repo, score: cosineSimilarity(queryVector, cached.vector) });
  }
  return ranked.sort((a, b) => b.score - a.score);
}
