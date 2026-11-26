import { expect, test } from "@playwright/test";
import { startGroqStandIn } from "../../api/groq-stand-in.ts";
import { signInAs } from "../sign-in-as.ts";
import { routeStack, seedBook, seedNotes } from "../web-stack.ts";

test("demo: finish a book and read its summary", async ({ page }) => {
  const stand = await startGroqStandIn();
  const title = `Invented Lighthouse Almanac ${Date.now()}`;
  const book = await seedBook("bt-test-alice", title);
  try {
    await seedNotes("bt-test-alice", book.id);
    await routeStack(page);
    await signInAs(page, "bt-test-alice");
    await page.goto("/");
    await page.getByRole("link", { name: title, exact: true }).click();
    await page.getByRole("link", { name: "Finish book" }).click();
    await page.getByRole("button", { name: "Finish book" }).click();

    const summary = page.getByRole("region", { name: "Your summary" });
    await expect(
      summary.getByText(/You noted that a pear orchard/),
    ).toBeVisible();
    await summary.getByRole("button", { name: "Write again" }).click();
    await expect(
      summary.getByRole("button", { name: "Write again" }),
    ).toBeEnabled();
  } finally {
    await book.remove();
    await stand.stop();
  }
});
