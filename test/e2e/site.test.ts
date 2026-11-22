import { expect, test } from "@playwright/test";
import { brand } from "@book-tracking-system/core/brand";
import { expectNoAxeViolations } from "./axe.ts";

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

  await expectNoAxeViolations(page);
});
