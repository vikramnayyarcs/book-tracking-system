import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "@playwright/test";
import { expectNoAxeViolations } from "../axe.ts";
import { signInAs } from "../sign-in-as.ts";

const routes = (process.env["UI_DIFF_ROUTES"] ?? "")
  .split(",")
  .map((route) => route.trim())
  .filter((route) => route.startsWith("/"));
const outDir = process.env["UI_DIFF_OUT"] ?? "";
const label = process.env["UI_DIFF_LABEL"] ?? "";

const viewports = [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1280, height: 800 },
];
const schemes = ["light", "dark"] as const;

const fileName = (route: string) =>
  route === "/" ? "home" : route.slice(1).replaceAll(/[^a-z0-9]+/gi, "-");

test("capture screenshots of the listed routes", async ({ browser }) => {
  if (routes.length === 0 || outDir === "" || label === "") {
    throw new Error(
      "Set UI_DIFF_ROUTES (comma-separated paths), UI_DIFF_OUT and UI_DIFF_LABEL (before or after)",
    );
  }
  const target = join(outDir, label);
  mkdirSync(target, { recursive: true });

  for (const viewport of viewports) {
    for (const colorScheme of schemes) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: 2,
        colorScheme,
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      await signInAs(page, "bt-test-alice");
      for (const route of routes) {
        await page.goto(route);
        await page.getByRole("main").waitFor();
        await expectNoAxeViolations(page);
        await page.screenshot({
          path: join(
            target,
            `${fileName(route)}.${viewport.name}.${colorScheme}.png`,
          ),
          fullPage: true,
        });
      }
      await context.close();
    }
  }
});
