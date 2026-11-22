import { expect, test } from "@playwright/test";
import { brand } from "@book-tracking-system/core/brand";

test("demo: the app opens", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: brand.name }),
  ).toBeVisible();
});
