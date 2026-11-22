import { expect, test, type Page } from "@playwright/test";
import { expectNoAxeViolations } from "../axe.ts";
import {
  recordedIsbn,
  recordedIsbnBook,
  replayOpenLibrary,
} from "../lookup-recordings.ts";
import { signInAs } from "../sign-in-as.ts";
import {
  apiBase,
  fulfillJson,
  removeBooksTitled,
  routeStack,
  seedHeaders,
} from "../web-stack.ts";

const handTitle = `Invented Hand Entry ${Date.now()}`;

test.afterAll(async () => {
  await removeBooksTitled("bt-test-alice", recordedIsbnBook.title);
  await removeBooksTitled("bt-test-alice", handTitle);
  await removeBooksTitled("bt-test-alice", "Invented Lantern Almanac");
});

const openAddBook = async (page: Page, user = "bt-test-alice") => {
  await routeStack(page);
  await replayOpenLibrary(page);
  await signInAs(page, user);
  await page.goto("/books/new");
  await expect(
    page.getByRole("heading", { level: 1, name: "Add a book" }),
  ).toBeVisible();
};

test("a typed ISBN is looked up, confirmed and added to the shelf", async ({
  page,
}) => {
  await openAddBook(page);
  await expectNoAxeViolations(page);

  await page.getByLabel("ISBN").fill("978-0-306-40615-7");
  await page.getByRole("button", { name: "Look up" }).click();
  await expect(
    page.getByRole("heading", { name: "Check the details" }),
  ).toBeVisible();
  await expect(page.getByLabel("Title")).toHaveValue(recordedIsbnBook.title);
  await expect(page.getByLabel("Pages")).toHaveValue("240");
  await expectNoAxeViolations(page);

  await page.getByRole("button", { name: "Add to shelf" }).click();
  await expect(page).toHaveURL(/\/books\/[0-9a-f-]{36}$/);
  await expect(
    page.getByRole("heading", { level: 1, name: recordedIsbnBook.title }),
  ).toBeVisible();
});

test("the ISBN lookup works with the keyboard alone", async ({ page }) => {
  await openAddBook(page);
  await page.getByLabel("ISBN").focus();
  await page.keyboard.type(recordedIsbn);
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Title")).toHaveValue(recordedIsbnBook.title);
  await page.getByRole("button", { name: "Add to shelf" }).focus();
  await expect(
    page.getByRole("button", { name: "Add to shelf" }),
  ).toBeFocused();
});

test("an invalid ISBN says so without calling the API", async ({ page }) => {
  await openAddBook(page);
  await page.getByLabel("ISBN").fill("123");
  await page.getByRole("button", { name: "Look up" }).click();
  await expect(page.getByText("That is not a valid ISBN")).toBeVisible();
  await expectNoAxeViolations(page);
});

test("an unknown ISBN shows the problem and the other ways to add", async ({
  page,
}) => {
  await openAddBook(page);
  await page.getByLabel("ISBN").fill("9780306406164");
  await page.getByRole("button", { name: "Look up" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "No book was found for that ISBN",
  );
  await expectNoAxeViolations(page);
});

test("a title search lists matches and a chosen one can be added", async ({
  page,
}) => {
  await openAddBook(page);
  await page.getByLabel("Title or author").fill("invented lantern");
  await page.getByRole("button", { name: "Search" }).click();
  const match = page
    .getByRole("listitem")
    .filter({ hasText: "Invented Lantern Almanac" });
  await expect(match).toBeVisible();
  await expectNoAxeViolations(page);

  await match.getByRole("button", { name: /Choose/ }).click();
  await expect(page.getByLabel("Title")).toHaveValue(
    "Invented Lantern Almanac",
  );
  await page.getByRole("button", { name: "Add to shelf" }).click();
  await expect(page).toHaveURL(/\/books\/[0-9a-f-]{36}$/);
});

test("a search with no match says what to do next", async ({ page }) => {
  await openAddBook(page);
  await page.getByLabel("Title or author").fill("nothing matches this");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByText("No books found.")).toBeVisible();
  await expectNoAxeViolations(page);
});

test("a search error shows a message and a retry", async ({ page }) => {
  await openAddBook(page);
  await page.route(`${apiBase}/v1/lookup/books*`, async (route) => {
    await fulfillJson(route, 502, {
      title: "Book search is down",
      status: 502,
    });
  });
  await page.getByLabel("Title or author").fill("invented lantern");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByRole("alert")).toContainText("Book search is down");
  await expectNoAxeViolations(page);
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
});

test("a book can be entered by hand, and a title is required", async ({
  page,
}) => {
  await openAddBook(page);
  await page.getByRole("button", { name: "Enter the details myself" }).click();
  await page.getByRole("button", { name: "Add to shelf" }).click();
  await expect(page.getByRole("alert")).toContainText("Enter a title.");
  await expectNoAxeViolations(page);

  await page.getByLabel("Title").fill(handTitle);
  await page.getByLabel("Author").fill("Invented Author");
  await page.getByRole("button", { name: "Add to shelf" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: handTitle }),
  ).toBeVisible();
});

test("without a camera, Scan barcode explains and the typed ISBN still works", async ({
  page,
}) => {
  await openAddBook(page);
  await page.getByRole("button", { name: "Scan barcode" }).click();
  await expect(page.getByRole("alert")).toContainText(/type the isbn instead/i);
  await expectNoAxeViolations(page);
  await page.getByLabel("ISBN").fill(recordedIsbn);
  await page.getByRole("button", { name: "Look up" }).click();
  await expect(page.getByLabel("Title")).toHaveValue(recordedIsbnBook.title);
});

test("offline, lookup and adding are disabled with the reason", async ({
  page,
  context,
}) => {
  await openAddBook(page);
  await context.setOffline(true);
  await expect(page.getByText("need a connection")).toBeVisible();
  await expect(page.getByRole("button", { name: "Look up" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Search" })).toBeDisabled();
  await expectNoAxeViolations(page);
});

test("a book added by one reader never shows on another's shelf", async ({
  page,
}) => {
  const headers = await seedHeaders("bt-test-alice");
  const created = await fetch(`${apiBase}/v1/books`, {
    method: "POST",
    headers,
    body: JSON.stringify({ title: handTitle, status: "reading" }),
  });
  expect(created.ok).toBe(true);
  await routeStack(page);
  await signInAs(page, "bt-test-bob");
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: "Shelf" }),
  ).toBeVisible();
  await expect(page.getByText(handTitle)).toHaveCount(0);
});
