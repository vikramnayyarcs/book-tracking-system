import { expect, test } from "@playwright/test";
import { brand } from "@book-tracking-system/core/brand";
import { expectNoAxeViolations } from "../axe.ts";

test("the app loads, shows the brand and has no accessibility violations", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { level: 1, name: brand.name }),
  ).toBeVisible();
  await expectNoAxeViolations(page);
});
