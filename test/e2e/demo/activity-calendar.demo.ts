import { expect, test } from "@playwright/test";
import { signInAs } from "../sign-in-as.ts";
import { apiBase, routeStack, seedBook, seedHeaders } from "../web-stack.ts";

test("demo: see the days with an entry in the activity calendar", async ({
  page,
}) => {
  const year = new Date().getFullYear() - 1;
  const book = await seedBook(
    "bt-test-alice",
    `Invented Lantern Atlas ${Date.now()}`,
  );
  try {
    const headers = await seedHeaders("bt-test-alice");
    for (const date of [`${year}-03-03`, `${year}-03-05`, `${year}-04-12`]) {
      await fetch(`${apiBase}/v1/sessions`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          id: crypto.randomUUID(),
          bookId: book.id,
          date,
          noteText: "An invented note about lanterns.",
        }),
      });
    }
    await routeStack(page);
    await signInAs(page, "bt-test-alice");
    await page.goto("/activity");
    await expect(
      page.getByRole("heading", { level: 1, name: "Activity" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Previous year" }).click();
    await expect(
      page.getByText(`3 days with an entry in ${year}.`),
    ).toBeVisible();
    await page.getByRole("heading", { name: "March" }).scrollIntoViewIfNeeded();
  } finally {
    await book.remove();
  }
});
