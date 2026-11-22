import { expect, test } from "@playwright/test";
import { recordedIsbnBook, replayOpenLibrary } from "../lookup-recordings.ts";
import { signInAs } from "../sign-in-as.ts";
import { removeBooksTitled, routeStack } from "../web-stack.ts";

test("demo: add a book by ISBN", async ({ page }) => {
  try {
    await routeStack(page);
    await replayOpenLibrary(page);
    await signInAs(page, "bt-test-alice");
    await page.goto("/books/new");
    await expect(
      page.getByRole("heading", { level: 1, name: "Add a book" }),
    ).toBeVisible();

    await page.getByLabel("ISBN", { exact: true }).fill("978-0-306-40615-7");
    await page.getByRole("button", { name: "Look up" }).click();
    await expect(page.getByLabel("Title", { exact: true })).toHaveValue(
      recordedIsbnBook.title,
    );

    await page.getByRole("button", { name: "Add to shelf" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: recordedIsbnBook.title }),
    ).toBeVisible();
  } finally {
    await removeBooksTitled("bt-test-alice", recordedIsbnBook.title);
  }
});
