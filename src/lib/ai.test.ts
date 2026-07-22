import { beforeEach, describe, expect, test } from "bun:test";

const backing = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => backing.get(k) ?? null,
  setItem: (k: string, v: string) => void backing.set(k, v),
  removeItem: (k: string) => void backing.delete(k),
  clear: () => backing.clear(),
};

import {
  clearAiConfig,
  cosineSimilarity,
  getAiConfig,
  isAiConfigured,
  setAiConfig,
  textHash,
} from "./ai";

beforeEach(() => {
  backing.clear();
});

describe("AI provider config", () => {
  test("no config stored returns null and not-configured", () => {
    expect(getAiConfig()).toBeNull();
    expect(isAiConfigured()).toBe(false);
  });

  test("round-trips a stored config, filling in default model names", () => {
    setAiConfig({
      baseUrl: "https://bellows.example/v1",
      apiKey: "sk-test",
      chatModel: "",
      embeddingModel: "",
    });
    const config = getAiConfig();
    expect(config?.baseUrl).toBe("https://bellows.example/v1");
    expect(config?.apiKey).toBe("sk-test");
    expect(config?.chatModel).toBe("gpt-4o-mini");
    expect(config?.embeddingModel).toBe("text-embedding-3-small");
    expect(isAiConfigured()).toBe(true);
  });

  test("preserves explicit model names instead of defaulting", () => {
    setAiConfig({
      baseUrl: "https://bellows.example/v1",
      apiKey: "sk-test",
      chatModel: "anvil-bellows-chat",
      embeddingModel: "anvil-bellows-embed",
    });
    const config = getAiConfig();
    expect(config?.chatModel).toBe("anvil-bellows-chat");
    expect(config?.embeddingModel).toBe("anvil-bellows-embed");
  });

  test("a config missing baseUrl or apiKey is treated as not configured", () => {
    setAiConfig({ baseUrl: "", apiKey: "sk-test", chatModel: "", embeddingModel: "" });
    expect(getAiConfig()).toBeNull();
    setAiConfig({ baseUrl: "https://x", apiKey: "", chatModel: "", embeddingModel: "" });
    expect(getAiConfig()).toBeNull();
  });

  test("clearAiConfig removes a stored config", () => {
    setAiConfig({ baseUrl: "https://x", apiKey: "k", chatModel: "", embeddingModel: "" });
    expect(isAiConfigured()).toBe(true);
    clearAiConfig();
    expect(isAiConfigured()).toBe(false);
  });
});

describe("cosineSimilarity", () => {
  test("identical vectors have similarity 1", () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 6);
  });

  test("orthogonal vectors have similarity 0", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 6);
  });

  test("opposite vectors have similarity -1", () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1, 6);
  });

  test("a zero vector never divides by zero", () => {
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
  });

  test("works with Float32Array inputs", () => {
    const a = new Float32Array([1, 2, 3]);
    const b = new Float32Array([1, 2, 3]);
    expect(cosineSimilarity(a, b)).toBeCloseTo(1, 6);
  });
});

describe("textHash", () => {
  test("is deterministic for the same input", () => {
    expect(textHash("octocat/Hello-World")).toBe(textHash("octocat/Hello-World"));
  });

  test("differs for different input", () => {
    expect(textHash("a")).not.toBe(textHash("b"));
  });

  test("is stable across calls (regression guard against accidental non-determinism)", () => {
    // Not asserting a specific hash value (that would over-pin the
    // algorithm) — just that repeated hashing of varied strings never
    // collides for these easy cases, which would silently break cache
    // invalidation.
    const inputs = ["repo-a::desc", "repo-a::desc2", "repo-b::desc"];
    const hashes = new Set(inputs.map(textHash));
    expect(hashes.size).toBe(inputs.length);
  });
});
