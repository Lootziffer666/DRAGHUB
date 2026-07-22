/**
 * Generic OpenAI-compatible AI provider client. Deliberately provider-
 * agnostic — DRAGHUB has no fixed AI vendor. The maintainer points this at
 * whichever OpenAI-compatible endpoint they run (e.g. their own
 * ANVIL-BELLOWS instance) or a hosted one, by configuring a base URL, an
 * API key and model names in Settings. Nothing here assumes OpenAI itself;
 * it only assumes the `/chat/completions` and `/embeddings` request/response
 * shapes the "OpenAI-compatible" convention standardizes on.
 */

const CONFIG_KEY = "draghub-ai-config";

export type AiConfig = {
  baseUrl: string;
  apiKey: string;
  chatModel: string;
  embeddingModel: string;
};

export function getAiConfig(): AiConfig | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AiConfig>;
    if (!parsed.baseUrl || !parsed.apiKey) return null;
    return {
      baseUrl: parsed.baseUrl,
      apiKey: parsed.apiKey,
      chatModel: parsed.chatModel || "gpt-4o-mini",
      embeddingModel: parsed.embeddingModel || "text-embedding-3-small",
    };
  } catch {
    return null;
  }
}

export function setAiConfig(config: AiConfig): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

export function clearAiConfig(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(CONFIG_KEY);
}

export function isAiConfigured(): boolean {
  return getAiConfig() !== null;
}

function endpoint(base: string, path: string): string {
  return `${base.replace(/\/+$/, "")}${path}`;
}

/** Sends a single chat-completion request and returns the assistant's text.
 * Throws a readable error if the provider isn't configured or the request
 * fails — callers show it directly rather than guessing at a cause. */
export async function chatComplete(
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  opts: { temperature?: number } = {}
): Promise<string> {
  const config = getAiConfig();
  if (!config)
    throw new Error(
      "No AI provider configured — add a base URL and API key in Settings."
    );
  const res = await fetch(endpoint(config.baseUrl, "/chat/completions"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.chatModel,
      messages,
      temperature: opts.temperature ?? 0.2,
    }),
  });
  if (!res.ok) {
    throw new Error(
      `AI chat request failed (${res.status}). Check the base URL, API key and model name in Settings.`
    );
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return data.choices?.[0]?.message?.content ?? "";
}

/** Embeds a batch of texts in one request, preserving input order. */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const config = getAiConfig();
  if (!config)
    throw new Error(
      "No AI provider configured — add a base URL and API key in Settings."
    );
  if (texts.length === 0) return [];
  const res = await fetch(endpoint(config.baseUrl, "/embeddings"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({ model: config.embeddingModel, input: texts }),
  });
  if (!res.ok) {
    throw new Error(
      `AI embedding request failed (${res.status}). Check the base URL, API key and embedding model in Settings.`
    );
  }
  const data = (await res.json()) as { data?: { embedding: number[]; index: number }[] };
  const items = data.data ?? [];
  const ordered = [...items].sort((a, b) => a.index - b.index);
  return ordered.map((d) => d.embedding);
}

export function cosineSimilarity(a: Float32Array | number[], b: Float32Array | number[]): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

/** Cheap, deterministic, non-cryptographic string hash (FNV-1a) — used to
 * detect when a repo's AI-relevant fields changed since the last cached
 * category/embedding, not for anything security-sensitive. */
export function textHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}
