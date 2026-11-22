import { expect, test } from "@playwright/test";
import { brand } from "@book-tracking-system/core/brand";

test("demo: a visitor without a session is sent to sign-in", async ({
  page,
}) => {
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(
    page.getByRole("heading", { level: 1, name: `Sign in to ${brand.name}` }),
  ).toBeVisible();
});
