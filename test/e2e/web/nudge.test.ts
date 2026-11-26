import { expect, test, type Page } from "@playwright/test";
import { expectNoAxeViolations } from "../axe.ts";
import { signInAs } from "../sign-in-as.ts";
import { apiBase, routeStack, seedBook, seedHeaders } from "../web-stack.ts";

const restore = async (externalId: string, nudgeTime: string | null) => {
  const headers = await seedHeaders(externalId);
  await fetch(`${apiBase}/v1/me`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ nudgeTime, notReadingToday: false }),
  });
};

const readMe = async (externalId: string) => {
  const headers = await seedHeaders(externalId);
  const response = await fetch(`${apiBase}/v1/me`, { headers });
  return (await response.json()) as {
    nudgeTime: string | null;
    notReadingUntil: string | null;
  };
};

let book: Awaited<ReturnType<typeof seedBook>>;

test.beforeAll(async () => {
  book = await seedBook(
    "bt-test-alice",
    `Invented Reminder Atlas ${Date.now()}`,
  );
});

test.afterAll(async () => {
  await book.remove();
});

test.beforeEach(async () => {
  await restore("bt-test-alice", "20:30");
  await restore("bt-test-bob", null);
});

test.afterEach(async () => {
  await restore("bt-test-alice", null);
});

const openSettings = async (page: Page, externalId: string) => {
  await routeStack(page);
  await signInAs(page, externalId);
  await page.goto("/settings");
  await expect(
    page.getByRole("heading", { level: 1, name: "Settings" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Daily reminder" }),
  ).toBeVisible();
};

const reminderSwitch = (page: Page) =>
  page.getByRole("switch", { name: "Daily reminder" });

test("the section shows the saved time and the iPhone note", async ({
  page,
}) => {
  await openSettings(page, "bt-test-alice");
  await expect(
    page.getByText("On iPhone, push works only after you add the app", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(reminderSwitch(page)).toBeChecked();
  await expect(page.getByLabel("Reminder time")).toHaveValue("20:30");
  await expectNoAxeViolations(page);
});

test("a new time is saved", async ({ page }) => {
  await openSettings(page, "bt-test-alice");
  await page.getByLabel("Reminder time").fill("21:15");
  await page.getByRole("button", { name: "Save time" }).click();
  await expect(page.getByRole("button", { name: "Save time" })).toBeDisabled();
  expect((await readMe("bt-test-alice")).nudgeTime).toBe("21:15");
  await page.reload();
  await expect(page.getByLabel("Reminder time")).toHaveValue("21:15");
  await expectNoAxeViolations(page);
});

test("Not reading today silences the reminder until tomorrow", async ({
  page,
}) => {
  await openSettings(page, "bt-test-alice");
  await page.getByRole("button", { name: "Not reading today" }).click();
  await expect(
    page.getByText("No reminder today. It comes back tomorrow."),
  ).toBeVisible();
  expect((await readMe("bt-test-alice")).notReadingUntil).not.toBeNull();
  await expectNoAxeViolations(page);

  await page
    .getByRole("button", { name: "Start reminders again today" })
    .click();
  await expect(
    page.getByRole("button", { name: "Not reading today" }),
  ).toBeVisible();
  expect((await readMe("bt-test-alice")).notReadingUntil).toBeNull();
});

test("the switch turns the reminder off, with the keyboard alone", async ({
  page,
}) => {
  await openSettings(page, "bt-test-alice");
  await reminderSwitch(page).focus();
  await page.keyboard.press("Space");
  await expect(reminderSwitch(page)).not.toBeChecked();
  await expect(page.getByLabel("Reminder time")).toHaveCount(0);
  expect((await readMe("bt-test-alice")).nudgeTime).toBeNull();
  await expectNoAxeViolations(page);
});

test("another reader sees their own settings, which are off", async ({
  page,
}) => {
  await openSettings(page, "bt-test-bob");
  await expect(reminderSwitch(page)).not.toBeChecked();
  await expect(page.getByLabel("Reminder time")).toHaveCount(0);
  await expectNoAxeViolations(page);
});

test("without notification permission the switch is off and says why", async ({
  page,
}) => {
  await openSettings(page, "bt-test-bob");
  await expect(reminderSwitch(page)).toBeDisabled();
  await expect(page.getByRole("note")).toContainText(
    /blocked|cannot receive|Add to Home Screen/,
  );
  expect((await readMe("bt-test-bob")).nudgeTime).toBeNull();
  await expectNoAxeViolations(page);
});

test("an API error shows a message and a retry works", async ({ page }) => {
  await openSettings(page, "bt-test-alice");
  await page.route(`${apiBase}/v1/me`, async (route) => {
    if (route.request().method() !== "PATCH") {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 500,
      contentType: "application/problem+json",
      body: JSON.stringify({ title: "Settings are down", status: 500 }),
    });
  });
  await page.getByRole("button", { name: "Not reading today" }).click();
  await expect(page.getByRole("alert")).toContainText("Settings are down");
  await expectNoAxeViolations(page);

  await page.unroute(`${apiBase}/v1/me`);
  await page.getByRole("button", { name: "Not reading today" }).click();
  await expect(
    page.getByText("No reminder today. It comes back tomorrow."),
  ).toBeVisible();
});

test("offline, the controls are off with the reason", async ({
  page,
  context,
}) => {
  await openSettings(page, "bt-test-alice");
  await context.setOffline(true);
  await expect(
    page.getByText("You are offline. Reminder settings need a connection."),
  ).toBeVisible();
  await expect(reminderSwitch(page)).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Not reading today" }),
  ).toBeDisabled();
  await expectNoAxeViolations(page);
});

test("the reminder link opens Log session for the book in Reading", async ({
  page,
}) => {
  await routeStack(page);
  await signInAs(page, "bt-test-alice");
  await page.goto("/log");
  await expect(page).toHaveURL(/\/books\/[^/]+\/log$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Log session" }),
  ).toBeVisible();
  await expectNoAxeViolations(page);
});
