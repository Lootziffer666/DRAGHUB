import { beforeEach, describe, expect, test } from "bun:test";
import {
  registerFileHandler,
  listFileHandlers,
  handlersFor,
  handlersForSurface,
  defaultFileHandler,
  extensionOf,
  __resetFileHandlersForTests,
} from "./registry";
import type { FileHandlerDefinition } from "./types";

function handler(over: Partial<FileHandlerDefinition>): FileHandlerDefinition {
  return {
    id: "test-handler",
    title: "Test Handler",
    applicationId: "test-app",
    extensions: [],
    surfaces: ["window"],
    priority: 0,
    canHandle: () => true,
    ...over,
  };
}

beforeEach(() => {
  __resetFileHandlersForTests();
});

describe("extensionOf", () => {
  test("extracts a lowercased extension", () => {
    expect(extensionOf("src/a.TS")).toBe("ts");
    expect(extensionOf("README.md")).toBe("md");
  });
  test("returns empty string for extensionless paths", () => {
    expect(extensionOf("Dockerfile")).toBe("");
    expect(extensionOf("src/a")).toBe("");
  });
  test("ignores dots in directory names, not just the filename", () => {
    expect(extensionOf(".github/workflows/build")).toBe("");
    expect(extensionOf("v1.0/README")).toBe("");
    expect(extensionOf("v1.0/README.md")).toBe("md");
  });
});

describe("registerFileHandler", () => {
  test("registering with an existing id replaces it (idempotent registration)", () => {
    registerFileHandler(handler({ id: "a", title: "First" }));
    registerFileHandler(handler({ id: "a", title: "Second" }));
    expect(listFileHandlers()).toHaveLength(1);
    expect(listFileHandlers()[0].title).toBe("Second");
  });
});

describe("handlersFor", () => {
  test("matches by explicit extension list", () => {
    registerFileHandler(handler({ id: "png", extensions: ["png"] }));
    registerFileHandler(handler({ id: "md", extensions: ["md"] }));
    const result = handlersFor({ repoKey: "o/r", path: "a.png" });
    expect(result.map((h) => h.id)).toEqual(["png"]);
  });

  test("an empty extensions array matches any extension (wildcard)", () => {
    registerFileHandler(handler({ id: "fallback", extensions: [] }));
    expect(handlersFor({ repoKey: "o/r", path: "a.xyz" }).map((h) => h.id)).toEqual([
      "fallback",
    ]);
  });

  test("canHandle can veto an extension match", () => {
    registerFileHandler(
      handler({ id: "gate", extensions: ["png"], canHandle: () => false }),
    );
    expect(handlersFor({ repoKey: "o/r", path: "a.png" })).toHaveLength(0);
  });

  test("results are sorted by priority descending, then registration order", () => {
    registerFileHandler(handler({ id: "low", extensions: [], priority: 1 }));
    registerFileHandler(handler({ id: "high", extensions: [], priority: 10 }));
    registerFileHandler(handler({ id: "mid-a", extensions: [], priority: 5 }));
    registerFileHandler(handler({ id: "mid-b", extensions: [], priority: 5 }));
    const ids = handlersFor({ repoKey: "o/r", path: "a.txt" }).map((h) => h.id);
    expect(ids).toEqual(["high", "mid-a", "mid-b", "low"]);
  });

  test("a resource-specific handler and a scoped wildcard both apply — .md example", () => {
    registerFileHandler(
      handler({ id: "markdown-preview", extensions: ["md"], priority: 30 }),
    );
    registerFileHandler(handler({ id: "code-editor", extensions: [], priority: 10 }));
    registerFileHandler(
      handler({
        id: "raw-text",
        extensions: [],
        priority: 10,
        canHandle: (r) => extensionOf(r.path) !== "png",
      }),
    );
    const ids = handlersFor({ repoKey: "o/r", path: "README.md" }).map((h) => h.id);
    expect(ids).toEqual(["markdown-preview", "code-editor", "raw-text"]);
  });
});

describe("defaultFileHandler", () => {
  test("returns the highest-priority match", () => {
    registerFileHandler(handler({ id: "low", extensions: ["png"], priority: 1 }));
    registerFileHandler(handler({ id: "high", extensions: ["png"], priority: 5 }));
    expect(defaultFileHandler({ repoKey: "o/r", path: "a.png" })?.id).toBe("high");
  });

  test("returns null when nothing matches", () => {
    registerFileHandler(handler({ id: "png-only", extensions: ["png"] }));
    expect(defaultFileHandler({ repoKey: "o/r", path: "a.zip" })).toBeNull();
  });
});

describe("handlersForSurface", () => {
  test("filters to handlers declaring the requested surface", () => {
    registerFileHandler(
      handler({ id: "inline-only", extensions: ["md"], surfaces: ["inline"] }),
    );
    registerFileHandler(
      handler({ id: "window-only", extensions: ["md"], surfaces: ["window"] }),
    );
    registerFileHandler(
      handler({ id: "both", extensions: ["md"], surfaces: ["inline", "window"] }),
    );
    const resource = { repoKey: "o/r", path: "a.md" };
    expect(handlersForSurface(resource, "inline").map((h) => h.id).sort()).toEqual([
      "both",
      "inline-only",
    ]);
    expect(handlersForSurface(resource, "window").map((h) => h.id).sort()).toEqual([
      "both",
      "window-only",
    ]);
  });
});
