import { expect, test } from "@playwright/test";
import { signInAs } from "../sign-in-as.ts";
import { apiBase, routeStack, seedBook, seedHeaders } from "../web-stack.ts";

test("demo: set the daily reminder", async ({ page }) => {
  await routeStack(page);
  await signInAs(page, "bt-test-alice");
  const headers = await seedHeaders("bt-test-alice");
  const patch = (body: unknown) =>
    fetch(`${apiBase}/v1/me`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(body),
    });
  const book = await seedBook(
    "bt-test-alice",
    `Invented Reminder Atlas ${Date.now()}`,
  );
  await patch({ nudgeTime: "20:30", notReadingToday: false });
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
    await patch({ nudgeTime: null, notReadingToday: false });
    await book.remove();
  }
});
