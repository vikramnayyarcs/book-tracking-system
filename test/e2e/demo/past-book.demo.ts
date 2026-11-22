import { expect, test } from "@playwright/test";
import { startGroqStandIn } from "../../api/groq-stand-in.ts";
import { signInAs } from "../sign-in-as.ts";
import { removeBooksTitled, routeStack } from "../web-stack.ts";

test("demo: add a book finished before the app", async ({ page }) => {
  const stand = await startGroqStandIn();
  const title = `Invented Harbour Almanac ${Date.now()}`;
  try {
    await routeStack(page);
    await signInAs(page, "bt-test-alice");
    await page.goto("/books/new");
    await page
      .getByRole("button", { name: "Enter the details myself" })
      .click();
    await page.getByLabel("Title", { exact: true }).fill(title);
    await page.getByText("Finished before", { exact: true }).click();

    await page.getByLabel("Month, 1 to 12").fill("3");
    await page.getByLabel("Year finished").fill("2019");
    await page.getByText("4", { exact: true }).click();
    await page.getByText("Type a note", { exact: true }).click();
    await page
      .getByLabel("Write what you remember")
      .fill("An invented memory: routine is a form of attention.");
    await page.getByRole("button", { name: "Add past book" }).click();

    await expect(page.getByText("Session saved.")).toBeVisible();
    await expect(page.getByText("finished March 2019")).toBeVisible();
    await page
      .getByRole("button", { name: "Give me 3 recall prompts" })
      .click();
    await expect(
      page.getByRole("button", { name: "Save answer 1" }),
    ).toBeVisible();
    await page.unrouteAll({ behavior: "ignoreErrors" });
  } finally {
    await removeBooksTitled("bt-test-alice", title);
    await stand.stop();
  }
});
