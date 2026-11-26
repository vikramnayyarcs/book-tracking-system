import { expect, test } from "@playwright/test";
import { signInAs } from "../sign-in-as.ts";
import { apiBase, routeStack, seedBook, seedHeaders } from "../web-stack.ts";

test("demo: see books per month and ratings on the activity page", async ({
  page,
}) => {
  const book = await seedBook(
    "bt-test-alice",
    `Invented Lantern Atlas ${Date.now()}`,
  );
  try {
    await fetch(`${apiBase}/v1/books/${book.id}/finish`, {
      method: "POST",
      headers: await seedHeaders("bt-test-alice"),
      body: JSON.stringify({ rating: 5 }),
    });
    await routeStack(page);
    await signInAs(page, "bt-test-alice");
    await page.goto("/activity");
    const books = page.getByRole("heading", { name: "Books per month" });
    await expect(books).toBeVisible();
    await books.scrollIntoViewIfNeeded();
    await page.getByText("Show books per month as a table").click();
    await page
      .getByRole("heading", { name: "Ratings" })
      .scrollIntoViewIfNeeded();
    await expect(page.getByText("5 stars")).toBeVisible();
  } finally {
    await book.remove();
  }
});
