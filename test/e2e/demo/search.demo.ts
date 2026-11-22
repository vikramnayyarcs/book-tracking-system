import { expect, test } from "@playwright/test";
import { signInAs } from "../sign-in-as.ts";
import { apiBase, routeStack, seedBook, seedHeaders } from "../web-stack.ts";

test("demo: search the vault and see highlighted matches", async ({ page }) => {
  const title = `Invented Tidewater Atlas ${Date.now()}`;
  const book = await seedBook("bt-test-alice", title);
  try {
    const headers = await seedHeaders("bt-test-alice");
    await fetch(`${apiBase}/v1/books/${book.id}/finish`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        rating: 4,
        review: "An invented review about lanterns and slow tides.",
      }),
    });
    await routeStack(page);
    await signInAs(page, "bt-test-alice");
    await page.goto("/search");
    await expect(
      page.getByRole("heading", { level: 1, name: "Search" }),
    ).toBeVisible();

    await page.getByLabel("Search your notes").fill("lanterns");
    await page.getByRole("button", { name: "Search" }).click();
    const result = page.getByRole("listitem").filter({ hasText: title });
    await expect(result).toBeVisible();
    await expect(result.locator("mark")).toHaveText("lanterns");
  } finally {
    await book.remove();
  }
});
