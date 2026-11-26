import { expect, test, type Page } from "@playwright/test";
import { startGroqStandIn } from "../../api/groq-stand-in.ts";
import { expectNoAxeViolations } from "../axe.ts";
import { signInAs } from "../sign-in-as.ts";
import {
  apiBase,
  fulfillJson,
  routeStack,
  seedBook,
  seedHeaders,
} from "../web-stack.ts";

let stand: Awaited<ReturnType<typeof startGroqStandIn>>;
const books: Awaited<ReturnType<typeof seedBook>>[] = [];

test.beforeAll(async () => {
  stand = await startGroqStandIn();
});

test.afterAll(async () => {
  for (const book of books) await book.remove();
  await stand.stop();
});

test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

const pngBytes = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

const photo = { name: "page.png", mimeType: "image/png", buffer: pngBytes };

const openBook = async (page: Page) => {
  const book = await seedBook(
    "bt-test-alice",
    `Invented Quote Photo Almanac ${crypto.randomUUID()}`,
  );
  books.push(book);
  const calls = await routeStack(page);
  await signInAs(page, "bt-test-alice");
  await page.goto(`/books/${book.id}`);
  await expect(
    page.getByRole("button", { name: "Add a quote from a photo" }),
  ).toBeVisible();
  return { book, calls };
};

const quotes = (page: Page) => page.getByRole("region", { name: "Quotes" });

test("a photo is read, the passage is selected, and it is saved as a quote with its page", async ({
  page,
}) => {
  const { book, calls } = await openBook(page);
  await expectNoAxeViolations(page);
  const upload = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/books/${book.id}/quote-photos`) &&
      response.request().method() === "POST",
  );

  await page.locator("input[type=file]").setInputFiles(photo);
  const photoId = ((await (await upload).json()) as { id: string }).id;
  await expect(page.getByRole("button", { name: "Save quote" })).toBeVisible();
  await expectNoAxeViolations(page);
  expect(calls).toContain("PUT storage-upload");

  await page.getByText("Nobody asked him why. The sea, he said, kept").click();
  await page.getByText("better accounts than any bank in the valley.").click();
  await page.getByLabel("Page number").fill("12");
  await expectNoAxeViolations(page);
  await page.getByRole("button", { name: "Save quote" }).click();

  await expect(page.getByText("Quote saved.")).toBeVisible();
  await expect(
    quotes(page).getByText(
      "Nobody asked him why. The sea, he said, kept better accounts than any bank in the valley.",
    ),
  ).toBeVisible();
  await expect(quotes(page).getByText("Page 12")).toBeVisible();
  await expectNoAxeViolations(page);

  const headers = await seedHeaders("bt-test-alice");
  const again = await fetch(`${apiBase}/v1/quote-photos/${photoId}/ocr`, {
    method: "POST",
    headers,
  });
  expect(again.status).toBe(404);
});

test("the main action works with the keyboard alone", async ({ page }) => {
  await openBook(page);
  await page.locator("input[type=file]").setInputFiles(photo);
  const first = page.getByRole("checkbox", {
    name: "The lighthouse keeper of Marrowick counted tides",
  });
  await first.focus();
  await page.keyboard.press("Space");
  await expect(first).toBeChecked();
  await page.getByLabel("Page number").focus();
  await page.keyboard.type("7");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Quote saved.")).toBeVisible();
  await expect(quotes(page).getByText("Page 7")).toBeVisible();
});

test("a missing selection or page number is explained and nothing is saved", async ({
  page,
}) => {
  const { calls } = await openBook(page);
  await page.locator("input[type=file]").setInputFiles(photo);
  await page.getByLabel("Page number").fill("5");
  await page.getByRole("button", { name: "Save quote" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Select at least one line.",
  );
  await expectNoAxeViolations(page);

  await page
    .getByText("The lighthouse keeper of Marrowick counted tides")
    .click();
  await page.getByLabel("Page number").fill("0");
  await page.getByRole("button", { name: "Save quote" }).click();
  await expect(page.getByRole("alert")).toContainText("whole number");
  expect(
    calls.filter(
      (call) => call.startsWith("POST ") && call.endsWith("/insights"),
    ),
  ).toEqual([]);
});

test("a photo with no text says so and offers a new photo", async ({
  page,
}) => {
  await openBook(page);
  await page.route(`${apiBase}/v1/quote-photos/*/ocr`, (route) =>
    route.request().method() === "POST"
      ? fulfillJson(route, 200, { lines: [] })
      : route.fallback(),
  );
  await page.locator("input[type=file]").setInputFiles(photo);
  await expect(page.getByText("No text found on the photo.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Take another photo" }),
  ).toBeVisible();
  await expectNoAxeViolations(page);
});

test("a reading error is shown and a new photo can succeed", async ({
  page,
}) => {
  await openBook(page);
  const pattern = `${apiBase}/v1/quote-photos/*/ocr`;
  await page.route(pattern, (route) =>
    route.request().method() === "POST"
      ? fulfillJson(route, 500, {
          title: "The server had a problem",
          status: 500,
        })
      : route.fallback(),
  );
  await page.locator("input[type=file]").setInputFiles(photo);
  await expect(page.getByRole("alert")).toContainText(
    "The server had a problem",
  );
  await expect(page.getByRole("alert")).toContainText("take a new one");
  await expectNoAxeViolations(page);

  await page.unroute(pattern);
  await page.locator("input[type=file]").setInputFiles(photo);
  await expect(page.getByRole("button", { name: "Save quote" })).toBeVisible();
});

test("a file that is not an image is refused before any upload", async ({
  page,
}) => {
  const { calls } = await openBook(page);
  await page.locator("input[type=file]").setInputFiles({
    name: "notes.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("not an image"),
  });
  await expect(page.getByRole("alert")).toContainText("JPEG, PNG or WebP");
  expect(calls.filter((call) => call.includes("quote-photos"))).toEqual([]);
});

test("offline, the photo button is off and says why", async ({
  page,
  context,
}) => {
  await openBook(page);
  await context.setOffline(true);
  await expect(
    page.getByText("Offline. A quote photo needs a connection."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add a quote from a photo" }),
  ).toBeDisabled();
  await expectNoAxeViolations(page);
});

test("another reader cannot read the photo or see the quote", async ({
  page,
}) => {
  const { book } = await openBook(page);
  const upload = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/books/${book.id}/quote-photos`) &&
      response.request().method() === "POST",
  );
  await page.locator("input[type=file]").setInputFiles(photo);
  const photoId = ((await (await upload).json()) as { id: string }).id;
  await page
    .getByText("The lighthouse keeper of Marrowick counted tides")
    .click();
  await page.getByLabel("Page number").fill("3");
  await page.getByRole("button", { name: "Save quote" }).click();
  await expect(page.getByText("Quote saved.")).toBeVisible();

  const theirs = await seedHeaders("bt-test-bob");
  const ocr = await fetch(`${apiBase}/v1/quote-photos/${photoId}/ocr`, {
    method: "POST",
    headers: theirs,
  });
  expect(ocr.status).toBe(404);
  const insights = await fetch(`${apiBase}/v1/books/${book.id}/insights`, {
    headers: theirs,
  });
  expect(insights.status).toBe(404);
});
