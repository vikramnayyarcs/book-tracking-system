import { expect, test } from "@playwright/test";
import { signInAs } from "../sign-in-as.ts";

test("demo: the account menu in the header", async ({ page }) => {
  await signInAs(page, "bt-test-alice");
  const trigger = page
    .getByRole("banner")
    .getByRole("button", { name: "Account menu" });
  await expect(trigger).toBeVisible();
  await trigger.click();
  await expect(page.getByRole("menuitem", { name: "Sign out" })).toBeVisible();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
});
