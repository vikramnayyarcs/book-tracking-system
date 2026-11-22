import { expect, test } from "@playwright/test";
import { startGroqStandIn } from "../../api/groq-stand-in.ts";
import { signInAs } from "../sign-in-as.ts";
import { routeStack, seedBook } from "../web-stack.ts";

test("demo: log a session offline and see the insights", async ({
  page,
  context,
}) => {
  const stand = await startGroqStandIn();
  const title = `Invented Lighthouse Almanac ${Date.now()}`;
  const book = await seedBook("bt-test-alice", title);
  try {
    await routeStack(page);
    await signInAs(page, "bt-test-alice");
    await page.goto(`/books/${book.id}/log`);
    await expect(page.getByText(title, { exact: true })).toBeVisible();

    await context.setOffline(true);
    await expect(page.getByText("You are offline.")).toBeVisible();
    await page.getByLabel("From page").fill("10");
    await page.getByLabel("To page").fill("24");
    await page.getByText("Type a note", { exact: true }).click();
    await page
      .getByLabel("Write your note")
      .fill(
        "Chapter three says routine is a form of attention. Invented demo note.",
      );
    await page.getByRole("button", { name: "Save session" }).click();
    await expect(
      page.getByRole("heading", { name: "Waiting to upload" }),
    ).toBeVisible();

    await context.setOffline(false);
    await expect(page.getByText("Session saved.")).toBeVisible();
    await expect(
      page
        .getByRole("listitem")
        .filter({ hasText: "Routine is a form of attention." }),
    ).toBeVisible();
  } finally {
    await book.remove();
    await stand.stop();
  }
});
