import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { expectNoAxeViolations } from "../axe.ts";
import { signInAs } from "../sign-in-as.ts";
import { apiBase, routeStack, seedBook } from "../web-stack.ts";

test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

let book: Awaited<ReturnType<typeof seedBook>>;
const title = `Invented Export Atlas ${Date.now()}`;

test.beforeAll(async () => {
  book = await seedBook("bt-test-alice", title);
});

test.afterAll(async () => {
  await book.remove();
});

const openSettings = async (page: Page, externalId: string) => {
  await routeStack(page);
  await signInAs(page, externalId);
  await page.goto("/settings");
  await expect(
    page.getByRole("heading", { level: 1, name: "Settings" }),
  ).toBeVisible();
};

const downloadZip = async (page: Page) => {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Download my data" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(
    /^vault-\d{4}-\d{2}-\d{2}\.zip$/,
  );
  const bytes = await readFile(await download.path());
  return bytes.toString("latin1");
};

test("the button downloads a zip with the JSON and Markdown", async ({
  page,
}) => {
  await openSettings(page, "bt-test-alice");
  await expectNoAxeViolations(page);
  const zip = await downloadZip(page);
  expect(zip).toMatch(/vault-\d{4}-\d{2}-\d{2}\.json/);
  expect(zip).toMatch(/vault-\d{4}-\d{2}-\d{2}\.md/);
  expect(zip).toContain(title);
  await expect(page.getByText("Your export was downloaded.")).toBeVisible();
  await expectNoAxeViolations(page);
});

test("the export works with the keyboard alone", async ({ page }) => {
  await openSettings(page, "bt-test-alice");
  await page.getByRole("button", { name: "Download my data" }).focus();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.keyboard.press("Enter"),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.zip$/);
});

test("another reader's export never holds this book", async ({ page }) => {
  await openSettings(page, "bt-test-bob");
  const zip = await downloadZip(page);
  expect(zip).not.toContain(title);
});

test("an API error shows a message and a retry works", async ({ page }) => {
  await openSettings(page, "bt-test-alice");
  await page.route(`${apiBase}/v1/export*`, async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "application/problem+json",
      body: JSON.stringify({ title: "Export is down", status: 500 }),
    });
  });
  await page.getByRole("button", { name: "Download my data" }).click();
  await expect(page.getByRole("alert")).toContainText("Export is down");
  await expectNoAxeViolations(page);

  await page.unroute(`${apiBase}/v1/export*`);
  expect(await downloadZip(page)).toContain(title);
});

test("offline, the button is disabled with the reason", async ({
  page,
  context,
}) => {
  await openSettings(page, "bt-test-alice");
  await context.setOffline(true);
  await expect(page.getByText("Export needs a connection.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Download my data" }),
  ).toBeDisabled();
  await expectNoAxeViolations(page);
});
