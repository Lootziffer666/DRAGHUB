import { expect, test } from "@playwright/test";

test("desktop shell renders with no console errors", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(String(err)));

  await page.goto("/");

  // Recycle Bin / Settings are opened from the Start Menu's tool grid, not
  // seeded as default desktop icons (native workspace redesign) — the
  // Taskbar's launcher and the Dock's Start button are what's always on
  // screen.
  await expect(page.getByText("Launcher / Search")).toBeVisible();
  await expect(page.getByRole("button", { name: "Start Menu" })).toBeVisible();
  expect(consoleErrors).toEqual([]);
});

test("Dock: pinning a repository from the Start Menu shows it in the Dock", async ({
  page,
}) => {
  await page.route("https://api.github.com/**", async (route) => {
    const url = route.request().url();
    if (url.includes("/search/repositories")) {
      return route.fulfill({
        json: {
          total_count: 1,
          items: [
            {
              id: 1,
              full_name: "octocat/Hello-World",
              owner: { login: "octocat" },
              html_url: "https://github.com/octocat/Hello-World",
              description: "My first repository",
              stargazers_count: 1,
              language: null,
              topics: [],
            },
          ],
        },
      });
    }
    return route.fulfill({ json: [] });
  });

  await page.goto("/");
  await expect(page.getByText("Pin a repository from the Start Menu")).toBeVisible();

  await page.getByRole("button", { name: "Start Menu" }).click();
  await page.getByPlaceholder(/Chart a course/).fill("hello-world");
  await page
    .getByRole("button", { name: "Pin octocat/Hello-World to Dock" })
    .click();
  await page.keyboard.press("Escape");

  await expect(page.getByRole("button", { name: "Open octocat/Hello-World" })).toBeVisible();

  // Pins survive a reload.
  await page.reload();
  await expect(page.getByRole("button", { name: "Open octocat/Hello-World" })).toBeVisible();
});
