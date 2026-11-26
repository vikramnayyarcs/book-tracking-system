import { expect, test } from "@playwright/test";
import { signInAs } from "../sign-in-as.ts";
import { apiBase, routeStack, seedHeaders } from "../web-stack.ts";

test("demo: set the daily reminder", async ({ page }) => {
  await routeStack(page);
  await signInAs(page, "bt-test-alice");
  try {
    await page.goto("/settings");
    await expect(
      page.getByRole("heading", { level: 2, name: "Daily reminder" }),
    ).toBeVisible();
    await expect(page.getByLabel("Reminder time")).toHaveValue("20:30");

    await page.getByLabel("Reminder time").fill("21:15");
    await page.getByRole("button", { name: "Save time" }).click();
    await expect(
      page.getByRole("button", { name: "Save time" }),
    ).toBeDisabled();

    await page.getByRole("button", { name: "Not reading today" }).click();
    await expect(
      page.getByText("No reminder today. It comes back tomorrow."),
    ).toBeVisible();

    await page.goto("/log");
    await expect(page).toHaveURL(/\/books\/[^/]+\/log$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Log session" }),
    ).toBeVisible();
  } finally {
    const headers = await seedHeaders("bt-test-alice");
    await fetch(`${apiBase}/v1/me`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ nudgeTime: "20:30", notReadingToday: false }),
    });
  }
});
