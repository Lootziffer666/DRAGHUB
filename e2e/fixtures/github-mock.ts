import type { Page } from "@playwright/test";

/**
 * Mocks the GitHub REST API for a single fake repository ("acme/demo") so
 * e2e specs can drive real desktop UI flows without live GitHub access —
 * this sandbox's network policy blocks api.github.com from the browser, and
 * real repositories would make tests flaky and rate-limited anyway.
 *
 * Extend FILES when a spec needs another fixture file; every entry needs a
 * contents-API response AND a directory-listing entry for its parent dir.
 */

export type MockFile = {
  path: string;
  /** Text content, or base64 for binary files (set `binary: true`). */
  content: string;
  binary?: boolean;
};

export const DEMO_REPO_FILES: MockFile[] = [
  { path: "README.md", content: "# Demo\n\nHello from a mocked repository.\n" },
  { path: "src/main.ts", content: "export function hello() {\n  return 'hi';\n}\n" },
  {
    path: "assets/logo.png",
    // 1x1 transparent PNG
    content:
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    binary: true,
  },
  {
    path: "assets/theme.mp3",
    content: Buffer.from("FAKE_MP3_BYTES_FOR_UI_TEST_ONLY_0123456789").toString("base64"),
    binary: true,
  },
  {
    path: "assets/archive.zip",
    content: Buffer.from("PK_FAKE_ZIP_BYTES_FOR_UI_TEST_ONLY").toString("base64"),
    binary: true,
  },
];

function dirEntry(path: string, size: number, type: "file" | "dir" = "file") {
  return {
    name: path.split("/").pop(),
    path,
    type,
    size,
    sha: `fake-${path}`,
    url: `https://api.github.com/repos/acme/demo/contents/${path}`,
  };
}

function decodedSize(f: MockFile): number {
  return f.binary ? Buffer.from(f.content, "base64").length : f.content.length;
}

/** Every distinct directory (including "") that appears as a prefix of a file path. */
function directoriesOf(files: MockFile[]): Set<string> {
  const dirs = new Set<string>([""]);
  for (const f of files) {
    const parts = f.path.split("/");
    for (let i = 1; i < parts.length; i++) dirs.add(parts.slice(0, i).join("/"));
  }
  return dirs;
}

export async function installGithubMock(page: Page, files: MockFile[] = DEMO_REPO_FILES) {
  const dirs = directoriesOf(files);

  await page.route("https://api.github.com/**", async (route) => {
    const url = new URL(route.request().url());
    const path = decodeURIComponent(url.pathname.replace(/%2F/gi, "/"));
    const headers = { "access-control-allow-origin": "*", "content-type": "application/json" };
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, headers, body: JSON.stringify(body) });

    if (path === "/search/repositories") {
      return json({
        items: [
          {
            id: 1,
            full_name: "acme/demo",
            owner: { login: "acme" },
            name: "demo",
            description: "Mocked demo repository for e2e tests",
            stargazers_count: 42,
            forks_count: 1,
            language: "TypeScript",
            topics: [],
            updated_at: new Date().toISOString(),
            html_url: "https://github.com/acme/demo",
          },
        ],
      });
    }
    if (path === "/repos/acme/demo") {
      return json({
        full_name: "acme/demo",
        default_branch: "main",
        description: "Mocked demo repository",
        stargazers_count: 42,
        forks_count: 1,
        language: "TypeScript",
        private: false,
        html_url: "https://github.com/acme/demo",
      });
    }
    if (path === "/repos/acme/demo/branches") return json([{ name: "main" }]);

    const contentsPrefix = "/repos/acme/demo/contents/";
    if (path.startsWith(contentsPrefix) || path === "/repos/acme/demo/contents") {
      const target = path === "/repos/acme/demo/contents" ? "" : path.slice(contentsPrefix.length);
      if (dirs.has(target)) {
        const children = files
          .filter((f) => {
            const parent = f.path.includes("/") ? f.path.slice(0, f.path.lastIndexOf("/")) : "";
            if (target === "") return !f.path.includes("/") || parent === "";
            return parent === target;
          })
          .map((f) => {
            const rest = target === "" ? f.path : f.path.slice(target.length + 1);
            return rest.includes("/") ? null : dirEntry(f.path, decodedSize(f));
          })
          .filter((e): e is NonNullable<typeof e> => e !== null);
        // Also list direct sub-directories of `target`.
        const subdirs = new Set<string>();
        for (const d of dirs) {
          if (d === target || d === "") continue;
          const parent = d.includes("/") ? d.slice(0, d.lastIndexOf("/")) : "";
          if (parent === target) subdirs.add(d);
        }
        const dirEntries = [...subdirs].map((d) => dirEntry(d, 0, "dir"));
        return json([...dirEntries, ...children]);
      }
      const file = files.find((f) => f.path === target);
      if (file) {
        return json({
          name: file.path.split("/").pop(),
          path: file.path,
          content: file.binary ? file.content : file.content,
          encoding: file.binary ? "base64" : "utf-8",
          size: decodedSize(file),
          download_url: null,
        });
      }
    }

    console.log("[github-mock] unmocked request:", path);
    return json({ message: "Not found in mock" }, 404);
  });
}
