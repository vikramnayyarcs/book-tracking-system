import { expect, test, type Page } from "@playwright/test";
import { startGroqStandIn } from "../../api/groq-stand-in.ts";
import { expectNoAxeViolations } from "../axe.ts";
import { signInAs } from "../sign-in-as.ts";
import { apiBase, routeStack, seedBook, seedHeaders } from "../web-stack.ts";

let stand: Awaited<ReturnType<typeof startGroqStandIn>>;
let book: Awaited<ReturnType<typeof seedBook>>;
const title = `Invented Lighthouse Almanac ${Date.now()}`;
const note =
  "Chapter three says routine is a form of attention. Invented test note.";

test.beforeAll(async () => {
  stand = await startGroqStandIn();
  book = await seedBook("bt-test-alice", title);
});

test.afterAll(async () => {
  await book.remove();
  await stand.stop();
});

const openLog = async (page: Page) => {
  const calls = await routeStack(page);
  await signInAs(page, "bt-test-alice");
  await page.goto(`/books/${book.id}/log`);
  await expect(
    page.getByRole("heading", { level: 1, name: "Log session" }),
  ).toBeVisible();
  await expect(page.getByText(title, { exact: true })).toBeVisible();
  return calls;
};

const typeNote = async (page: Page, text: string) => {
  await page.getByText("Type a note", { exact: true }).click();
  await page.getByLabel("From page").fill("10");
  await page.getByLabel("To page").fill("24");
  await page.getByLabel("Write your note").fill(text);
};

const insight = (page: Page, text: string) =>
  page.getByRole("listitem").filter({ hasText: text });

test("a typed note is saved, processed and shown with its insights", async ({
  page,
}) => {
  await openLog(page);
  await expectNoAxeViolations(page);

  await typeNote(page, note);
  await page.getByRole("button", { name: "Save session" }).click();

  await expect(page.getByText("Session saved.")).toBeVisible();
  await expect(page.getByLabel("Edit your note")).toHaveValue(note);
  await expect(insight(page, "Routine is a form of attention.")).toBeVisible();
  await expectNoAxeViolations(page);
});

test("the transcript and the insights can be edited, pinned and deleted", async ({
  page,
}) => {
  await openLog(page);
  await typeNote(page, note);
  await page.getByRole("button", { name: "Save session" }).click();
  await expect(page.getByText("Session saved.")).toBeVisible();

  const edited = "Chapter three: routine is attention. Edited invented note.";
  await page.getByLabel("Edit your note").fill(edited);
  await page.getByRole("button", { name: "Save your note" }).click();
  await expect(page.getByText("Saved.", { exact: true })).toBeVisible();

  const first = insight(page, "Routine is a form of attention.");
  await first.getByRole("button", { name: "Edit" }).click();
  await page
    .getByLabel("Edit insight")
    .fill("Routine is attention, kept daily.");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const changed = insight(page, "Routine is attention, kept daily.");
  await expect(changed).toBeVisible();

  await changed.getByRole("button", { name: "Pin" }).click();
  await expect(changed.getByRole("button", { name: "Unpin" })).toBeVisible();
  await expectNoAxeViolations(page);

  await changed.getByRole("button", { name: "Delete" }).click();
  await expect(changed).toHaveCount(0);
});

test("a session logged offline waits on the device, then uploads when the connection returns", async ({
  page,
  context,
}) => {
  const calls = await openLog(page);

  await context.setOffline(true);
  await expect(page.getByText("You are offline.")).toBeVisible();
  await typeNote(page, note);
  await page.getByRole("button", { name: "Save session" }).click();

  await expect(
    page.getByRole("heading", { name: "Waiting to upload" }),
  ).toBeVisible();
  await expect(page.getByText("1 session waiting to upload.")).toBeVisible();
  await expectNoAxeViolations(page);
  expect(calls.filter((call) => call.startsWith("POST /"))).toEqual([]);

  await context.setOffline(false);
  await expect(page.getByText("Session saved.")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Waiting to upload" }),
  ).toHaveCount(0);
  await expect(page.getByText("waiting to upload.")).toHaveCount(0);
  await expect(insight(page, "Routine is a form of attention.")).toBeVisible();
  expect(calls).toContain("POST /functions/v1/api/v1/sessions");
  await expectNoAxeViolations(page);
});

test("a failed upload keeps the session waiting with its reason, and upload now retries it", async ({
  page,
}) => {
  await openLog(page);
  await page.route(`${apiBase}/v1/sessions`, async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }
    await route.abort("connectionfailed");
  });

  await typeNote(page, note);
  await page.getByRole("button", { name: "Save session" }).click();
  await expect(
    page.getByText("Last try: No connection. Waiting to upload."),
  ).toBeVisible();
  await expectNoAxeViolations(page);

  await page.unroute(`${apiBase}/v1/sessions`);
  await page.getByRole("button", { name: "Upload now" }).click();
  await expect(page.getByText("Session saved.")).toBeVisible();
});

test("the form explains what is missing and keeps the page range in order", async ({
  page,
}) => {
  await openLog(page);

  await page.getByRole("button", { name: "Save session" }).click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Enter the first and last page" }),
  ).toBeVisible();

  await page.getByLabel("From page").fill("30");
  await page.getByLabel("To page").fill("12");
  await page.getByRole("button", { name: "Save session" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "must not be before" }),
  ).toBeVisible();

  await page.getByLabel("To page").fill("40");
  await page.getByRole("button", { name: "Save session" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Record a voice note" }),
  ).toBeVisible();
  await expectNoAxeViolations(page);

  await page.getByText("Chapter", { exact: true }).click();
  await page.getByRole("textbox", { name: "Chapter" }).fill("Chapter 3");
  await page.getByText("Type a note", { exact: true }).click();
  await page.getByLabel("Write your note").fill(note);
  await page.getByRole("button", { name: "Save session" }).click();
  await expect(page.getByText("Session saved.")).toBeVisible();
});

test("a voice note records with a timer, uploads and shows the transcript", async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== "chromium", "Only Chromium has a fake microphone");
  const calls = await openLog(page);

  await page.getByLabel("From page").fill("1");
  await page.getByLabel("To page").fill("9");
  await page.getByRole("button", { name: "Record", exact: true }).click();
  await expect(page.getByTestId("recording-timer")).toHaveText("0:01");
  await expectNoAxeViolations(page);
  await page.getByRole("button", { name: "Stop recording" }).click();
  await expect(page.getByText(/Voice note recorded, 0:0\d\./)).toBeVisible();

  await page.getByRole("button", { name: "Save session" }).click();
  await expect(page.getByText("Session saved.")).toBeVisible();
  await expect(page.getByLabel("Edit transcript")).toHaveValue(/\S/);
  expect(calls).toContain("PUT storage-upload");
  await expectNoAxeViolations(page);
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

test("the main action works with the keyboard alone", async ({ page }) => {
  await openLog(page);
  await page.getByText("Type a note", { exact: true }).click();
  await page.getByLabel("From page").focus();
  await page.keyboard.type("3");
  await page.keyboard.press("Tab");
  await page.keyboard.type("8");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.type(note);
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Session saved.")).toBeVisible();
});

test("another reader cannot read the session", async ({ page }) => {
  await openLog(page);
  await typeNote(page, note);
  await page.getByRole("button", { name: "Save session" }).click();
  await expect(page.getByText("Session saved.")).toBeVisible();

  const mine = await seedHeaders("bt-test-alice");
  const list = await fetch(`${apiBase}/v1/books/${book.id}/sessions`, {
    headers: mine,
  });
  const sessions = (await list.json()) as { items: { id: string }[] };
  const sessionId = sessions.items[0]?.id ?? "";
  expect(sessionId).not.toBe("");

  const theirs = await seedHeaders("bt-test-bob");
  const response = await fetch(`${apiBase}/v1/sessions/${sessionId}`, {
    headers: theirs,
  });
  expect(response.status).toBe(404);
});
