import { beforeEach, describe, expect, test } from "bun:test";
import { __resetFileHandlersForTests, handlersFor } from "./registry";
import { registerDefaultFileHandlers } from "./default-handlers";

beforeEach(() => {
  __resetFileHandlersForTests();
  registerDefaultFileHandlers();
});

function titlesFor(path: string): string[] {
  return handlersFor({ repoKey: "owner/repo", path }).map((h) => h.title);
}

describe("default file handlers — realistic per-extension menus", () => {
  test("a Markdown file offers Markdown Preview, Code Editor, Raw Text, Download", () => {
    expect(titlesFor("README.md")).toEqual([
      "Markdown Preview",
      "Code Editor",
      "Raw Text",
      "Download",
    ]);
  });

  test("an image offers Image Viewer and Download only — never Code Editor or Raw Text", () => {
    expect(titlesFor("assets/hero.png")).toEqual(["Image Viewer", "Download"]);
  });

  test("an audio file offers Audio Player and Download only", () => {
    expect(titlesFor("assets/theme.mp3")).toEqual(["Audio Player", "Download"]);
  });

  test("a plain source file offers Code Editor and Raw Text, not Markdown/Image/Audio", () => {
    expect(titlesFor("src/main.ts")).toEqual(["Code Editor", "Raw Text", "Download"]);
  });

  test("an archive offers only Download (no archive viewer yet)", () => {
    expect(titlesFor("dist/build.zip")).toEqual(["Download"]);
  });

  test("Download is always present, always last", () => {
    for (const path of ["a.md", "a.png", "a.mp3", "a.ts", "a.zip"]) {
      const titles = titlesFor(path);
      expect(titles[titles.length - 1]).toBe("Download");
    }
  });
});
