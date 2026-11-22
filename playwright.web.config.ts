import { defineConfig, devices } from "@playwright/test";

const demo = process.env["PW_SUITE"] === "demo";
const webkit = process.env["PW_BROWSER"] === "webkit";
const baseURL = "http://localhost:4173";

export default defineConfig({
  testDir: "test/e2e",
  testMatch: demo ? "demo/*.demo.ts" : "web/*.test.ts",
  globalSetup: "./test/e2e/clerk-setup.ts",
  forbidOnly: Boolean(process.env["CI"]),
  retries: 0,
  reporter: process.env["CI"]
    ? [["github"], ["html", { open: "never" }]]
    : "list",
  projects: [
    webkit
      ? { name: "webkit", use: { ...devices["Desktop Safari"] } }
      : { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  use: {
    baseURL,
    video:
      process.env["PW_VIDEO"] === "on"
        ? { mode: "on", size: { width: 1280, height: 720 } }
        : "off",
    trace: "off",
    launchOptions: webkit
      ? {}
      : {
          args: [
            "--use-fake-device-for-media-stream",
            "--use-fake-ui-for-media-stream",
          ],
          ...(process.env["PW_CHROMIUM_PATH"]
            ? { executablePath: process.env["PW_CHROMIUM_PATH"] }
            : {}),
        },
  },
  webServer: {
    command:
      "npm -w @book-tracking-system/web run build && npm -w @book-tracking-system/web run preview -- --port 4173 --strictPort",
    url: baseURL,
    reuseExistingServer: !process.env["CI"],
    env: {
      VITE_API_BASE_URL:
        process.env["API_BASE_URL"] ??
        "http://127.0.0.1:54321/functions/v1/api",
    },
  },
});
