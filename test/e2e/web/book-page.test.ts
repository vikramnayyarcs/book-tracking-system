import { expect, test, type Page } from "@playwright/test";
import { startGroqStandIn } from "../../api/groq-stand-in.ts";
import { expectNoAxeViolations } from "../axe.ts";
import { signInAs } from "../sign-in-as.ts";
import {
  apiBase,
  routeStack,
  seedBook,
  seedHeaders,
  seedNotes,
} from "../web-stack.ts";

let stand: Awaited<ReturnType<typeof startGroqStandIn>>;
const books: Awaited<ReturnType<typeof seedBook>>[] = [];

const makeBook = async (withNotes: boolean) => {
  const book = await seedBook(
    "bt-test-alice",
    `Invented Lighthouse Almanac ${crypto.randomUUID()}`,
  );
  books.push(book);
  if (withNotes) await seedNotes("bt-test-alice", book.id);
  return book;
};

test.beforeAll(async () => {
  stand = await startGroqStandIn();
});

test.afterAll(async () => {
  for (const book of books) await book.remove();
  await stand.stop();
});

const openBook = async (page: Page, id: string) => {
  const calls = await routeStack(page);
  await signInAs(page, "bt-test-alice");
  await page.goto(`/books/${id}`);
  return calls;
};

const pngBytes = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

test("the book page lists its sessions, insights and quotes", async ({
  page,
}) => {
  const book = await makeBook(true);
  await openBook(page, book.id);

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: /Invented Lighthouse Almanac/,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Pages 10 to 24", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText("Invented note: routine is a form of attention."),
  ).toBeVisible();
  const insights = page.getByRole("region", { name: "Insights" });
  await expect(
    insights.getByText("Routine is a form of attention."),
  ).toBeVisible();
  const quotes = page.getByRole("region", { name: "Quotes" });
  await expect(
    quotes.getByText("The habit of looking matters more than the log."),
  ).toBeVisible();
  await expect(quotes.getByText("Page 31")).toBeVisible();
  await expectNoAxeViolations(page);
});

test("a book with no notes says what to do next and cannot ask questions yet", async ({
  page,
}) => {
  const book = await makeBook(false);
  await openBook(page, book.id);

  await expect(page.getByText("No sessions yet.")).toBeVisible();
  await expect(page.getByText("No quotes saved yet.")).toBeVisible();
  await expect(
    page.getByText(
      "Log a session first. The questions come from your own notes.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Ask me 3 questions" }),
  ).toBeDisabled();
  await expectNoAxeViolations(page);
});

test("mid-book questions are written from the notes and the answers are kept", async ({
  page,
}) => {
  const book = await makeBook(true);
  await openBook(page, book.id);

  await page.getByRole("button", { name: "Ask me 3 questions" }).click();
  const first = page.getByLabel(/routine is a form of attention/);
  await expect(first).toBeVisible();
  await expect(page.getByRole("button", { name: /^Save answer/ })).toHaveCount(
    3,
  );
  await first.fill("I will notice one small thing each morning.");
  await page.getByRole("button", { name: "Save answer 1" }).click();
  await expect(page.getByText("Saved.", { exact: true })).toBeVisible();
  await expectNoAxeViolations(page);

  await page.reload();
  await expect(page.getByLabel(/routine is a form of attention/)).toHaveValue(
    "I will notice one small thing each morning.",
  );
  await expect(
    page.getByRole("button", { name: "Ask me 3 questions" }),
  ).toHaveCount(0);
});

test("a failed load shows the reason and try again loads it", async ({
  page,
}) => {
  const book = await makeBook(true);
  const calls = await routeStack(page);
  await signInAs(page, "bt-test-alice");
  const url = `${apiBase}/v1/books/${book.id}/sessions`;
  await page.route(url, (route) =>
    route.fulfill({
      status: 500,
      contentType: "application/problem+json",
      body: JSON.stringify({ title: "The server had a problem", status: 500 }),
    }),
  );
  await page.goto(`/books/${book.id}`);
  await expect(page.getByText("The server had a problem")).toBeVisible();
  await expectNoAxeViolations(page);

  await page.unroute(url);
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByText("Pages 10 to 24")).toBeVisible();
  expect(calls.length).toBeGreaterThan(0);
});

test("offline, the questions wait for a connection", async ({
  page,
  context,
}) => {
  const book = await makeBook(true);
  await openBook(page, book.id);
  await expect(page.getByText("Pages 10 to 24")).toBeVisible();

  await context.setOffline(true);
  await expect(page.getByText("You are offline.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Ask me 3 questions" }),
  ).toBeDisabled();
  await expect(
    page.getByText("Offline. Questions need a connection."),
  ).toBeVisible();
  await expectNoAxeViolations(page);
});

test("finishing a book saves the rating, photo, review and end questions", async ({
  page,
}) => {
  const book = await makeBook(true);
  const calls = await openBook(page, book.id);
  await page.getByRole("link", { name: "Finish book" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Finish book" }),
  ).toBeVisible();
  await expectNoAxeViolations(page);

  await page.getByText("4", { exact: true }).click();
  await page.locator("input[type=file]").setInputFiles({
    name: "finish.png",
    mimeType: "image/png",
    buffer: pngBytes,
  });
  await expect(page.getByText("Photo ready: finish.png")).toBeVisible();
  await page
    .getByLabel("Your review")
    .fill("An invented review: calm and exact.");
  await page.getByRole("button", { name: "Ask me 3 questions" }).click();
  await page
    .getByLabel(/routine is a form of attention/)
    .fill("Looking before logging.");
  await page.getByRole("button", { name: "Save answer 1" }).click();
  await expect(page.getByText("Saved.", { exact: true })).toBeVisible();
  await expectNoAxeViolations(page);

  await page.getByRole("button", { name: "Finish book" }).click();
  await expect(page.getByText("Rating: 4 out of 5")).toBeVisible();
  await expect(
    page.getByText("An invented review: calm and exact."),
  ).toBeVisible();
  await expect(page.getByText("Finished", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Finish book" })).toHaveCount(0);
  await expect(page.getByLabel(/routine is a form of attention/)).toHaveValue(
    "Looking before logging.",
  );
  expect(calls).toContain("PUT storage-upload");
  await expectNoAxeViolations(page);

  const mine = await seedHeaders("bt-test-alice");
  const review = await fetch(`${apiBase}/v1/books/${book.id}/review`, {
    headers: mine,
  });
  expect(((await review.json()) as { hasPhoto: boolean }).hasPhoto).toBe(true);
});

test("a photo of the wrong type is refused with a reason", async ({ page }) => {
  const book = await makeBook(false);
  await openBook(page, book.id);
  await page.goto(`/books/${book.id}/finish`);

  await page.locator("input[type=file]").setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("invented"),
  });
  await expect(
    page.getByRole("alert").filter({ hasText: "Choose a JPEG, PNG or WebP" }),
  ).toBeVisible();
  await expectNoAxeViolations(page);
});

test("the finish form works with the keyboard alone", async ({ page }) => {
  const book = await makeBook(false);
  await openBook(page, book.id);
  await page.goto(`/books/${book.id}/finish`);

  await page.getByLabel("Your review").focus();
  await page.keyboard.type("Invented keyboard review.");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Finished", { exact: true })).toBeVisible();
  await expect(page.getByText("Invented keyboard review.")).toBeVisible();
});

test("another reader cannot read the book's sessions or reflections", async ({
  page,
}) => {
  const book = await makeBook(true);
  await openBook(page, book.id);
  await page.getByRole("button", { name: "Ask me 3 questions" }).click();
  await expect(page.getByRole("button", { name: /^Save answer/ })).toHaveCount(
    3,
  );

  const theirs = await seedHeaders("bt-test-bob");
  for (const path of ["sessions", "insights", "reflections", "review"]) {
    const response = await fetch(`${apiBase}/v1/books/${book.id}/${path}`, {
      headers: theirs,
    });
    expect(response.status, path).toBe(404);
  }
  await page.unrouteAll({ behavior: "ignoreErrors" });
});
