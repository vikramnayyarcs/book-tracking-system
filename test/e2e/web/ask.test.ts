import { expect, test, type Page } from "@playwright/test";
import { expectNoAxeViolations } from "../axe.ts";
import { signInAs } from "../sign-in-as.ts";
import { apiBase, fulfillJson, routeStack } from "../web-stack.ts";

const askUrl = `${apiBase}/v1/ask`;
const bookId = "11111111-1111-4111-8111-111111111111";
const sessionId = "22222222-2222-4222-8222-222222222222";

const answer = {
  answered: true,
  answer: "You noted that zebrafinch songs change between seasons.",
  citations: [
    {
      insightId: "33333333-3333-4333-8333-333333333333",
      bookId,
      bookTitle: "Invented Orchard Field Notes",
      sessionId,
      sessionDate: "2026-03-01",
    },
  ],
  warn: false,
};

const openAsk = async (page: Page) => {
  await routeStack(page);
  await signInAs(page, "bt-test-alice");
  await page.goto("/ask");
  await expect(
    page.getByRole("heading", { level: 1, name: "Ask your vault" }),
  ).toBeVisible();
};

const ask = async (page: Page, question: string) => {
  await page.getByLabel("Your question").fill(question);
  await page.getByRole("button", { name: "Ask", exact: true }).click();
};

test("an answer shows citations that link to the book and session", async ({
  page,
}) => {
  await openAsk(page);
  await expectNoAxeViolations(page);
  await page.route(askUrl, (route) => fulfillJson(route, 200, answer));

  await ask(page, "What did I note about zebrafinch songs?");
  await expect(page.getByText(answer.answer)).toBeVisible();
  const citation = page.getByRole("link", {
    name: /Invented Orchard Field Notes/,
  });
  await expect(citation).toContainText("Mar 1, 2026");
  await expect(citation).toHaveAttribute(
    "href",
    `/books/${bookId}#session-${sessionId}`,
  );
  await expectNoAxeViolations(page);
});

test("a question the notes do not answer gets the empty state", async ({
  page,
}) => {
  await openAsk(page);
  await page.route(askUrl, (route) =>
    fulfillJson(route, 200, {
      answered: false,
      answer: "This is not in your notes.",
      citations: [],
      warn: false,
    }),
  );
  await ask(page, "What is the capital of nowhere?");
  await expect(page.getByText("Nothing to answer from.")).toBeVisible();
  await expect(page.getByRole("link", { name: /Invented/ })).toHaveCount(0);
  await expectNoAxeViolations(page);
});

test("the question works with the keyboard alone", async ({ page }) => {
  await openAsk(page);
  await page.route(askUrl, (route) => fulfillJson(route, 200, answer));
  await page.getByLabel("Your question").focus();
  await page.keyboard.type("zebrafinch songs?");
  await page.keyboard.press("Enter");
  await expect(page.getByText(answer.answer)).toBeVisible();
});

test("a refused question shows the reason and try again works", async ({
  page,
}) => {
  await openAsk(page);
  await page.route(askUrl, (route) =>
    fulfillJson(route, 403, {
      title: "You used all your vault questions this month",
      status: 403,
    }),
  );
  await ask(page, "zebrafinch songs?");
  await expect(page.getByRole("alert")).toContainText(
    "You used all your vault questions this month",
  );
  await expectNoAxeViolations(page);

  await page.unroute(askUrl);
  await page.route(askUrl, (route) => fulfillJson(route, 200, answer));
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByText(answer.answer)).toBeVisible();
});

test("offline, asking is disabled with the reason", async ({
  page,
  context,
}) => {
  await openAsk(page);
  await page.getByLabel("Your question").fill("zebrafinch songs?");
  await context.setOffline(true);
  await expect(page.getByText("Asking needs a connection.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Ask", exact: true }),
  ).toBeDisabled();
  await expectNoAxeViolations(page);
});
