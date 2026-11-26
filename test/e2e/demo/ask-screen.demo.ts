import { expect, test } from "@playwright/test";
import { signInAs } from "../sign-in-as.ts";
import { apiBase, fulfillJson, routeStack } from "../web-stack.ts";

test("demo: ask the vault and see an answer with citations", async ({
  page,
}) => {
  await routeStack(page);
  await signInAs(page, "bt-test-alice");
  await page.goto("/ask");
  await expect(
    page.getByRole("heading", { level: 1, name: "Ask your vault" }),
  ).toBeVisible();

  await page.route(`${apiBase}/v1/ask`, (route) =>
    fulfillJson(route, 200, {
      answered: true,
      answer: "You noted that zebrafinch songs change between seasons.",
      citations: [
        {
          insightId: "33333333-3333-4333-8333-333333333333",
          bookId: "11111111-1111-4111-8111-111111111111",
          bookTitle: "Invented Orchard Field Notes",
          sessionId: "22222222-2222-4222-8222-222222222222",
          sessionDate: "2026-03-01",
        },
      ],
      warn: false,
    }),
  );
  await page.getByLabel("Your question").fill("What did I note about songs?");
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  await expect(page.getByText("zebrafinch songs change")).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Invented Orchard Field Notes/ }),
  ).toBeVisible();
});
