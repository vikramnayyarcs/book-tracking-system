import { expect, test, type Page } from "@playwright/test";
import { expectNoAxeViolations } from "../axe.ts";
import { signInAs } from "../sign-in-as.ts";
import { apiBase, routeStack, seedBook, seedHeaders } from "../web-stack.ts";

let book: Awaited<ReturnType<typeof seedBook>>;
const title = `Invented Tidewater Atlas ${Date.now()}`;
const word = `zephyrine${Date.now()}`;

test.beforeAll(async () => {
  book = await seedBook("bt-test-alice", title);
  const headers = await seedHeaders("bt-test-alice");
  const response = await fetch(`${apiBase}/v1/books/${book.id}/finish`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      rating: 4,
      review: `An invented review about ${word} and slow tides.`,
    }),
  });
  expect(response.ok).toBe(true);
});

test.afterAll(async () => {
  await book.remove();
});

const openSearch = async (page: Page) => {
  await routeStack(page);
  await signInAs(page, "bt-test-alice");
  await page.goto("/search");
  await expect(
    page.getByRole("heading", { level: 1, name: "Search" }),
  ).toBeVisible();
};

const search = async (page: Page, q: string) => {
  await page.getByLabel("Search your notes").fill(q);
  await page.getByRole("button", { name: "Search" }).click();
};

test("a keyword finds a review, highlights it and links to the book", async ({
  page,
}) => {
  await openSearch(page);
  await expect(page.getByText("Type a word or phrase")).toBeVisible();
  await expectNoAxeViolations(page);

  await search(page, word);
  const result = page.getByRole("listitem").filter({ hasText: title });
  await expect(result).toBeVisible();
  await expect(result.locator("mark")).toHaveText(word);
  await expect(result.getByRole("link", { name: title })).toHaveAttribute(
    "href",
    `/books/${book.id}`,
  );
  await expectNoAxeViolations(page);
});

test("the search works with the keyboard alone", async ({ page }) => {
  await openSearch(page);
  await page.getByLabel("Search your notes").focus();
  await page.keyboard.type(word);
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("listitem").filter({ hasText: title }),
  ).toBeVisible();
});

test("a keyword with no match says so", async ({ page }) => {
  await openSearch(page);
  await search(page, `nomatch${Date.now()}`);
  await expect(page.getByText("No matches.")).toBeVisible();
  await expectNoAxeViolations(page);
});

test("another reader's notes never appear", async ({ page }) => {
  await routeStack(page);
  await signInAs(page, "bt-test-bob");
  await page.goto("/search");
  await search(page, word);
  await expect(page.getByText("No matches.")).toBeVisible();
  await expect(page.getByText(title)).toHaveCount(0);
});

test("an API error shows a message and a retry", async ({ page }) => {
  await openSearch(page);
  await page.route(`${apiBase}/v1/search*`, async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "application/problem+json",
      body: JSON.stringify({ title: "Search is down", status: 500 }),
    });
  });
  await search(page, word);
  await expect(page.getByRole("alert")).toContainText("Search is down");
  await expectNoAxeViolations(page);

  await page.unroute(`${apiBase}/v1/search*`);
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(
    page.getByRole("listitem").filter({ hasText: title }),
  ).toBeVisible();
});

test("offline, search is disabled with the reason", async ({
  page,
  context,
}) => {
  await openSearch(page);
  await context.setOffline(true);
  await expect(page.getByText("Search needs a connection.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Search" })).toBeDisabled();
  await expectNoAxeViolations(page);
});
