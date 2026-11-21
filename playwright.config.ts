import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "test/e2e",
  forbidOnly: Boolean(process.env["CI"]),
  retries: 0,
  reporter: process.env["CI"]
    ? [["github"], ["html", { open: "never" }]]
    : "list",
  use: {
    baseURL: "http://localhost:4321",
    video:
      process.env["PW_VIDEO"] === "on"
        ? { mode: "on", size: { width: 1280, height: 720 } }
        : "off",
    trace: "off",
    launchOptions: process.env["PW_CHROMIUM_PATH"]
      ? { executablePath: process.env["PW_CHROMIUM_PATH"] }
      : {},
  },
  webServer: {
    command:
      "npm -w @book-tracking-system/site run build && npm -w @book-tracking-system/site run preview -- --ignore-lock",
    url: "http://localhost:4321",
    reuseExistingServer: !process.env["CI"],
  },
});
