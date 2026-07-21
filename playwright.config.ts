import { defineConfig, devices } from "@playwright/test";

/**
 * The sandboxed dev/CI environment ships a pre-installed Chromium and sets
 * PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 so `bun install` never tries to fetch
 * browsers itself. `PLAYWRIGHT_BROWSERS_PATH` points at that install; we
 * resolve the stable `chromium` symlink from it instead of hardcoding a
 * version-numbered path (e.g. `chromium-1194`) that changes across images.
 * Locally (outside that environment) this falls back to Playwright's own
 * managed Chromium — run `bunx playwright install chromium` once there.
 */
const browsersPath = process.env.PLAYWRIGHT_BROWSERS_PATH;
const chromiumExecutablePath = browsersPath ? `${browsersPath}/chromium` : undefined;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: chromiumExecutablePath
          ? { executablePath: chromiumExecutablePath }
          : {},
      },
    },
  ],
  webServer: {
    command: "bun run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
