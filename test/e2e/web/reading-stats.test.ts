import { expect, test, type Page } from "@playwright/test";
import { expectNoAxeViolations } from "../axe.ts";
import { signInAs } from "../sign-in-as.ts";
import { apiBase, routeStack, seedBook, seedHeaders } from "../web-stack.ts";

test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

let book: Awaited<ReturnType<typeof seedBook>>;

test.beforeAll(async () => {
  book = await seedBook(
    "bt-test-alice",
    `Invented Lantern Atlas ${Date.now()}`,
  );
  const response = await fetch(`${apiBase}/v1/books/${book.id}/finish`, {
    method: "POST",
    headers: await seedHeaders("bt-test-alice"),
    body: JSON.stringify({ rating: 5 }),
  });
  expect(response.ok).toBe(true);
});

test.afterAll(async () => {
  await book.remove();
});

const openStats = async (page: Page) => {
  await routeStack(page);
  await signInAs(page, "bt-test-alice");
  await page.goto("/activity");
  await expect(
    page.getByRole("heading", { level: 2, name: "Reading stats" }),
  ).toBeVisible();
};

test("books per month and ratings show with a table alternative", async ({
  page,
}) => {
  await openStats(page);
  await expect(
    page.getByRole("heading", { name: "Books per month" }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: /finished in the last 12 months/ }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ratings" })).toBeVisible();
  await expect(page.getByText("5 stars")).toBeVisible();
  await expect(page.getByText(/streak|missed/i)).toHaveCount(0);

  await page.getByText("Show books per month as a table").click();
  const month = new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
  }).format(new Date());
  await expect(page.getByRole("rowheader", { name: month })).toBeVisible();
  await expectNoAxeViolations(page);
});

test("the table toggle works with the keyboard alone", async ({ page }) => {
  await openStats(page);
  await page.getByText("Show books per month as a table").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("columnheader", { name: "Books" })).toBeVisible();
});

test("an API error shows a message and a retry", async ({ page }) => {
  await routeStack(page);
  await signInAs(page, "bt-test-alice");
  await page.route(`${apiBase}/v1/stats*`, async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "application/problem+json",
      body: JSON.stringify({ title: "Stats are down", status: 500 }),
    });
  });
  await page.goto("/activity");
  await expect(page.getByRole("alert")).toContainText("Stats are down");
  await expectNoAxeViolations(page);

  await page.unroute(`${apiBase}/v1/stats*`);
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(
    page.getByRole("heading", { name: "Books per month" }),
  ).toBeVisible();
});
