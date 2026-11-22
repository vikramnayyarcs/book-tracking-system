import { expect, test } from "@playwright/test";
import { expectNoAxeViolations } from "../axe.ts";
import { signInAs } from "../sign-in-as.ts";

test("a signed-in reader sees the shell with its navigation", async ({
  page,
}) => {
  await signInAs(page, "bt-test-alice");

  const nav = page.getByRole("navigation", { name: "Main" });
  for (const label of ["Shelf", "Search", "Settings"]) {
    await expect(nav.getByRole("link", { name: label })).toBeVisible();
  }
  await expect(page).not.toHaveURL(/\/sign-in$/);
  await expectNoAxeViolations(page);
});

test("the signed-in column uses the phone's width", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signInAs(page, "bt-test-alice");

  const main = await page.getByRole("main").boundingBox();
  expect(main?.width ?? 0).toBeGreaterThan(300);
});

test("settings opens from the navigation", async ({ page }) => {
  await signInAs(page, "bt-test-alice");

  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Settings" })
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Settings", exact: true }),
  ).toBeVisible();
  await expectNoAxeViolations(page);
});
