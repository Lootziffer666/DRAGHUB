import { expect, test } from "@playwright/test";

test("desktop shell renders with no console errors", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(String(err)));

  await page.goto("/");

  await expect(page.getByText("Recycle Bin")).toBeVisible();
  await expect(page.getByText("Settings")).toBeVisible();
  await expect(page.getByText("Launcher / Search")).toBeVisible();
  expect(consoleErrors).toEqual([]);
});
