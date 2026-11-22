import { expect, test } from "@playwright/test";
import { startGroqStandIn } from "../../api/groq-stand-in.ts";
import { signInAs } from "../sign-in-as.ts";
import { routeStack, seedBook, seedNotes } from "../web-stack.ts";

test("demo: read a book page and finish the book", async ({ page }) => {
  const stand = await startGroqStandIn();
  const title = `Invented Lighthouse Almanac ${Date.now()}`;
  const book = await seedBook("bt-test-alice", title);
  try {
    await seedNotes("bt-test-alice", book.id);
    await routeStack(page);
    await signInAs(page, "bt-test-alice");
    await page.goto("/");
    await page.getByRole("link", { name: title }).click();
    await expect(page.getByText("Pages 10 to 24")).toBeVisible();

    await page.getByRole("button", { name: "Ask me 3 questions" }).click();
    const first = page.getByLabel(/routine is a form of attention/);
    await first.fill("I will notice one small thing each morning.");
    await page.getByRole("button", { name: "Save answer 1" }).click();
    await expect(page.getByText("Saved.", { exact: true })).toBeVisible();

    await page.getByRole("link", { name: "Finish book" }).click();
    await page.getByText("5", { exact: true }).click();
    await page.getByLabel("Your review").fill("An invented review: calm.");
    await page.getByRole("button", { name: "Finish book" }).click();
    await expect(page.getByText("Rating: 5 out of 5")).toBeVisible();
    await expect(page.getByText("Finished", { exact: true })).toBeVisible();
  } finally {
    await book.remove();
    await stand.stop();
  }
});
