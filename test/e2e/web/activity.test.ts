import { expect, test, type Page } from "@playwright/test";
import { expectNoAxeViolations } from "../axe.ts";
import { signInAs } from "../sign-in-as.ts";
import { apiBase, routeStack, seedBook, seedHeaders } from "../web-stack.ts";

const year = new Date().getFullYear() - 1;
let book: Awaited<ReturnType<typeof seedBook>>;

test.beforeAll(async () => {
  book = await seedBook(
    "bt-test-alice",
    `Invented Lantern Atlas ${Date.now()}`,
  );
  const headers = await seedHeaders("bt-test-alice");
  for (const date of [`${year}-03-03`, `${year}-03-05`]) {
    const response = await fetch(`${apiBase}/v1/sessions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        id: crypto.randomUUID(),
        bookId: book.id,
        date,
        noteText: "An invented note about lanterns.",
      }),
    });
    expect(response.ok).toBe(true);
  }
});

test.afterAll(async () => {
  await book.remove();
});

const openActivity = async (page: Page, user = "bt-test-alice") => {
  await routeStack(page);
  await signInAs(page, user);
  await page.goto("/activity");
  await expect(
    page.getByRole("heading", { level: 1, name: "Activity" }),
  ).toBeVisible();
};

const previousYear = (page: Page) =>
  page.getByRole("button", { name: "Previous year" });

test("days with an entry show in the calendar, with no streak", async ({
  page,
}) => {
  await openActivity(page);
  await previousYear(page).click();
  await expect(page.getByRole("heading", { name: String(year) })).toBeVisible();
  await expect(
    page.getByText(`2 days with an entry in ${year}.`),
  ).toBeVisible();
  await expect(
    page.getByText(`3, March 3, ${year}, has an entry`),
  ).toBeVisible();
  await expect(
    page.getByText(`5, March 5, ${year}, has an entry`),
  ).toBeVisible();
  await expect(page.getByText(/streak/i)).toHaveCount(0);
  await expectNoAxeViolations(page);
});

test("the year buttons work with the keyboard alone", async ({ page }) => {
  await openActivity(page);
  await previousYear(page).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByText(`2 days with an entry in ${year}.`),
  ).toBeVisible();
});

test("a year with no entries says what to do", async ({ page }) => {
  await openActivity(page);
  await expect(page.getByText(/No entries in \d{4} yet\./)).toBeVisible();
  await expect(page.getByText("Log a session")).toBeVisible();
  await expectNoAxeViolations(page);
});

test("another reader's entries never appear", async ({ page }) => {
  await openActivity(page, "bt-test-bob");
  await previousYear(page).click();
  await expect(page.getByText(`No entries in ${year} yet.`)).toBeVisible();
  await expect(page.getByText("has an entry")).toHaveCount(0);
});

test("an API error shows a message and a retry", async ({ page }) => {
  await routeStack(page);
  await signInAs(page, "bt-test-alice");
  await page.route(`${apiBase}/v1/activity*`, async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "application/problem+json",
      body: JSON.stringify({ title: "Activity is down", status: 500 }),
    });
  });
  await page.goto("/activity");
  await expect(page.getByRole("alert")).toContainText("Activity is down");
  await expectNoAxeViolations(page);

  await page.unroute(`${apiBase}/v1/activity*`);
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByText(/No entries in \d{4} yet\./)).toBeVisible();
});
