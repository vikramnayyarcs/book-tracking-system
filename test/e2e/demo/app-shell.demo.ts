import { expect, test } from "@playwright/test";
import { brand } from "@book-tracking-system/core/brand";
import { signInAs } from "../sign-in-as.ts";

test("demo: sign-in, then the signed-in shell", async ({ page }) => {
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(
    page.getByRole("heading", { level: 1, name: `Sign in to ${brand.name}` }),
  ).toBeVisible();
  await signInAs(page, "bt-test-alice");
  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Settings" })
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Settings", exact: true }),
  ).toBeVisible();
});
