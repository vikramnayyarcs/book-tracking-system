import { expect, test } from "@playwright/test";
import { signInAs } from "../sign-in-as.ts";
import { routeStack, seedBook } from "../web-stack.ts";

test("demo: download all your data as a zip", async ({ page }) => {
  const book = await seedBook(
    "bt-test-alice",
    `Invented Export Atlas ${Date.now()}`,
  );
  try {
    await routeStack(page);
    await signInAs(page, "bt-test-alice");
    await page.goto("/settings");
    await expect(
      page.getByRole("heading", { level: 1, name: "Settings" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Export your data" }),
    ).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Download my data" }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.zip$/);
    await expect(page.getByText("Your export was downloaded.")).toBeVisible();
  } finally {
    await book.remove();
  }
});
