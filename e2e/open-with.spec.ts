import { expect, type Page, test } from "@playwright/test";
import { installGithubMock } from "./fixtures/github-mock";

/**
 * Covers the file handler registry end to end: opening a mocked repository,
 * browsing into a folder, and checking that the "Open with" menu for each
 * file type matches exactly what the registry computes (no more, no fewer
 * entries), plus that selecting Image Viewer / Audio Player actually loads
 * an authenticated blob through an Object URL.
 */

async function openDemoRepoAssetsFolder(page: Page) {
  await installGithubMock(page);
  await page.goto("/");
  await page.getByText("Launcher / Search").click();
  await page.getByPlaceholder(/Search repositories/).fill("acme/demo");
  await expect(page.getByText("acme/demo", { exact: true })).toBeVisible();
  await page.getByText("acme/demo", { exact: true }).first().click();
  const table = page.getByRole("table");
  await expect(table.getByText("assets", { exact: true })).toBeVisible();
  await table.getByText("assets", { exact: true }).dblclick();
}

async function openWithMenuTitles(page: Page): Promise<string[]> {
  await page.getByText("Open with", { exact: false }).first().click();
  const menu = page.locator("div.absolute.left-0");
  await expect(menu).toBeVisible();
  return menu.getByRole("button").allTextContents();
}

test("repository opens and lists README.md, src/ and assets/", async ({ page }) => {
  await installGithubMock(page);
  await page.goto("/");
  await page.getByText("Launcher / Search").click();
  await page.getByPlaceholder(/Search repositories/).fill("acme/demo");
  await page.getByText("acme/demo", { exact: true }).first().click();

  const table = page.getByRole("table");
  await expect(table.getByText("README.md")).toBeVisible();
  await expect(table.getByText("src", { exact: true })).toBeVisible();
  await expect(table.getByText("assets", { exact: true })).toBeVisible();
});

test("Markdown file offers Markdown Preview, Code Editor, Raw Text, Download", async ({ page }) => {
  await installGithubMock(page);
  await page.goto("/");
  await page.getByText("Launcher / Search").click();
  await page.getByPlaceholder(/Search repositories/).fill("acme/demo");
  await page.getByText("acme/demo", { exact: true }).first().click();
  const table = page.getByRole("table");
  await table.getByText("README.md", { exact: true }).dblclick();

  const titles = await openWithMenuTitles(page);
  expect(titles).toEqual(["Markdown Preview", "Code Editor", "Raw Text", "Download"]);
});

test("image file offers Image Viewer and Download, and Image Viewer loads an authenticated blob", async ({
  page,
}) => {
  await openDemoRepoAssetsFolder(page);
  const table = page.getByRole("table");
  await table.getByText("logo.png", { exact: true }).dblclick();

  const titles = await openWithMenuTitles(page);
  expect(titles).toEqual(["Image Viewer", "Download"]);

  await page.getByRole("button", { name: "Image Viewer" }).click();
  // Scope to the newly opened File Viewer window specifically — logo.png is
  // also open as an inline tab in the Repository Explorer behind it, with
  // its own (equally valid) authenticated <img>.
  const viewerWindow = page.locator("section", { hasText: "FILE VIEWER" });
  const image = viewerWindow.locator("img[alt='logo.png']");
  await expect(image).toBeVisible();
  await expect(image).toHaveAttribute("src", /^blob:/);
});

test("audio file offers Audio Player and Download, and Audio Player renders a working <audio> element", async ({
  page,
}) => {
  await openDemoRepoAssetsFolder(page);
  const table = page.getByRole("table");
  await table.getByText("theme.mp3", { exact: true }).dblclick();

  const titles = await openWithMenuTitles(page);
  expect(titles).toEqual(["Audio Player", "Download"]);

  await page.getByRole("button", { name: "Audio Player" }).click();
  const audio = page.locator("audio");
  await expect(audio).toHaveCount(1);
  await expect(audio).toHaveAttribute("src", /^blob:/);
});

test("archive file offers Download only (no archive viewer yet)", async ({ page }) => {
  await openDemoRepoAssetsFolder(page);
  const table = page.getByRole("table");
  await table.getByText("archive.zip", { exact: true }).dblclick();

  const titles = await openWithMenuTitles(page);
  expect(titles).toEqual(["Download"]);
});
