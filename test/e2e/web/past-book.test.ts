import { expect, test, type Page } from "@playwright/test";
import { startGroqStandIn } from "../../api/groq-stand-in.ts";
import { expectNoAxeViolations } from "../axe.ts";
import { signInAs } from "../sign-in-as.ts";
import {
  apiBase,
  removeBooksTitled,
  routeStack,
  seedHeaders,
} from "../web-stack.ts";

let stand: Awaited<ReturnType<typeof startGroqStandIn>>;
const titles: string[] = [];
const note =
  "An invented memory: routine is a form of attention. I read it one winter.";

const newTitle = (label: string) => {
  const title = `Invented Past ${label} ${crypto.randomUUID()}`;
  titles.push(title);
  return title;
};

test.beforeAll(async () => {
  stand = await startGroqStandIn();
});

test.afterAll(async () => {
  for (const title of titles) await removeBooksTitled("bt-test-alice", title);
  await stand.stop();
});

test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

const pngBytes = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

const openPastForm = async (page: Page, title: string) => {
  const calls = await routeStack(page);
  await signInAs(page, "bt-test-alice");
  await page.goto("/books/new");
  await page.getByRole("button", { name: "Enter the details myself" }).click();
  await page.getByLabel("Title", { exact: true }).fill(title);
  await page.getByText("Finished before", { exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Add past book" }),
  ).toBeVisible();
  return calls;
};

const findBook = async (title: string) => {
  const headers = await seedHeaders("bt-test-alice");
  const list = await fetch(`${apiBase}/v1/books`, { headers });
  const { items } = (await list.json()) as {
    items: {
      id: string;
      title: string;
      status: string;
      finishedOn: string;
      finishedPrecision: string;
      addedRetrospectively: boolean;
    }[];
  };
  const book = items.find((item) => item.title === title);
  if (!book) throw new Error("The book was not saved");
  return { book, headers };
};

test("a past book is saved with its date, rating, photo and note, then shows insights and recall prompts", async ({
  page,
}) => {
  const title = newTitle("Lantern");
  const calls = await openPastForm(page, title);
  await expectNoAxeViolations(page);

  await page.getByLabel("Month, 1 to 12").fill("3");
  await page.getByLabel("Year finished").fill("2019");
  await page.getByText("4", { exact: true }).click();
  await page.locator("input[type=file]").setInputFiles({
    name: "cover.png",
    mimeType: "image/png",
    buffer: pngBytes,
  });
  await expect(page.getByText("Photo ready: cover.png")).toBeVisible();
  await page.getByText("Type a note", { exact: true }).click();
  await page.getByLabel("Write what you remember").fill(note);
  await expectNoAxeViolations(page);

  await page.getByRole("button", { name: "Add past book" }).click();
  await expect(page.getByRole("heading", { name: "Book added" })).toBeVisible();
  await expect(page.getByText("finished March 2019")).toBeVisible();
  await expect(page.getByText("Session saved.")).toBeVisible();
  await expect(
    page
      .getByRole("listitem")
      .filter({ hasText: "Routine is a form of attention." }),
  ).toBeVisible();
  await expectNoAxeViolations(page);

  await page.getByRole("button", { name: "Give me 3 recall prompts" }).click();
  await expect(page.getByRole("button", { name: /^Save answer/ })).toHaveCount(
    3,
  );
  await expectNoAxeViolations(page);
  expect(calls).toContain("PUT storage-upload");

  const { book, headers } = await findBook(title);
  expect(book).toMatchObject({
    status: "finished",
    finishedOn: "2019-03-01",
    finishedPrecision: "month",
    addedRetrospectively: true,
  });
  const review = await fetch(`${apiBase}/v1/books/${book.id}/review`, {
    headers,
  });
  expect(await review.json()).toMatchObject({ rating: 4, hasPhoto: true });

  await page.getByRole("link", { name: "Go to the book" }).click();
  await expect(page).toHaveURL(/\/books\/[0-9a-f-]{36}$/);
});

test("a year-only past book keeps year precision and works with the keyboard", async ({
  page,
}) => {
  const title = newTitle("Almanac");
  await openPastForm(page, title);
  await page.getByText("Year only", { exact: true }).click();
  await expect(page.getByLabel("Month, 1 to 12")).toHaveCount(0);

  await page.getByLabel("Year finished").focus();
  await page.keyboard.type("2015");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Book added" })).toBeVisible();
  await expect(page.getByText("finished 2015")).toBeVisible();

  const { book } = await findBook(title);
  expect(book).toMatchObject({
    finishedOn: "2015-01-01",
    finishedPrecision: "year",
    addedRetrospectively: true,
  });
});

test("a bad date is explained and nothing is saved", async ({ page }) => {
  const title = newTitle("Baddate");
  const calls = await openPastForm(page, title);
  await page.getByLabel("Month, 1 to 12").fill("13");
  await page.getByLabel("Year finished").fill("2019");
  await page.getByRole("button", { name: "Add past book" }).click();
  await expect(page.getByRole("alert")).toContainText("from 1 to 12");
  await expectNoAxeViolations(page);

  await page.getByLabel("Year finished").fill("19");
  await page.getByRole("button", { name: "Add past book" }).click();
  await expect(page.getByRole("alert")).toContainText("four digits");
  expect(calls).not.toContain("POST /v1/books");
});

test("an API error is shown and a retry can succeed", async ({ page }) => {
  const title = newTitle("Failing");
  await openPastForm(page, title);
  const url = `${apiBase}/v1/books`;
  await page.route(url, (route) =>
    route.request().method() === "POST"
      ? route.fulfill({
          status: 500,
          contentType: "application/problem+json",
          headers: { "access-control-allow-origin": "http://localhost:4173" },
          body: JSON.stringify({
            title: "The server had a problem",
            status: 500,
          }),
        })
      : route.fallback(),
  );
  await page.getByLabel("Month, 1 to 12").fill("1");
  await page.getByLabel("Year finished").fill("2018");
  await page.getByRole("button", { name: "Add past book" }).click();
  await expect(page.getByText("The server had a problem")).toBeVisible();
  await expectNoAxeViolations(page);

  await page.unroute(url);
  await page.getByRole("button", { name: "Add past book" }).click();
  await expect(page.getByRole("heading", { name: "Book added" })).toBeVisible();
});

test("offline, adding a past book is off and says why", async ({
  page,
  context,
}) => {
  await openPastForm(page, newTitle("Offline"));
  await context.setOffline(true);
  await expect(
    page.getByText("Offline. Adding a book needs a connection."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add past book" }),
  ).toBeDisabled();
  await expectNoAxeViolations(page);
});

test("another reader cannot see a past book or its recall prompts", async ({
  page,
}) => {
  const title = newTitle("Private");
  await openPastForm(page, title);
  await page.getByLabel("Year finished").fill("2012");
  await page.getByText("Year only", { exact: true }).click();
  await page.getByRole("button", { name: "Add past book" }).click();
  await page.getByRole("button", { name: "Give me 3 recall prompts" }).click();
  await expect(page.getByRole("button", { name: /^Save answer/ })).toHaveCount(
    3,
  );

  const { book } = await findBook(title);
  const theirs = await seedHeaders("bt-test-bob");
  for (const path of ["", "/sessions", "/reflections", "/review"]) {
    const response = await fetch(`${apiBase}/v1/books/${book.id}${path}`, {
      headers: theirs,
    });
    expect(response.status, path).toBe(404);
  }
});
