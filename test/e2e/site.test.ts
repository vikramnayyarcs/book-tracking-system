import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { brand } from "@book-tracking-system/core/brand";

test("site shows the brand and has no accessibility violations", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { level: 1, name: brand.name }),
  ).toBeVisible();
  await expect(page.getByText(brand.tagline)).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Join the waitlist" }),
  ).toHaveAttribute("href", brand.waitlistUrl);

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});
