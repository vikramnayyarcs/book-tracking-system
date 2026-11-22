import { expect, test } from "@playwright/test";
import { brand } from "@book-tracking-system/core/brand";
import { expectNoAxeViolations } from "../axe.ts";

const privatePaths = ["/", "/search", "/settings", "/books/b1/log"];

for (const path of privatePaths) {
  test(`without a session, ${path} redirects to the sign-in page`, async ({
    page,
  }) => {
    await page.goto(path);

    await expect(page).toHaveURL(/\/sign-in$/);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: `Sign in to ${brand.name}`,
      }),
    ).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Main" })).toHaveCount(0);
    await expectNoAxeViolations(page);
  });
}

test("the sign-in page works with the keyboard and has no accessibility violations", async ({
  page,
}) => {
  await page.goto("/sign-in");

  await expect(
    page.getByRole("heading", { level: 1, name: `Sign in to ${brand.name}` }),
  ).toBeVisible();
  await page.keyboard.press("Tab");
  await expectNoAxeViolations(page);
});
