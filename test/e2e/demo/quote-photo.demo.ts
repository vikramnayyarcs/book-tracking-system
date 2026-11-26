import { expect, test } from "@playwright/test";
import { startGroqStandIn } from "../../api/groq-stand-in.ts";
import { signInAs } from "../sign-in-as.ts";
import { routeStack, seedBook } from "../web-stack.ts";

const pngBytes = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

test("demo: save a quote from a photo of a page", async ({ page }) => {
  const stand = await startGroqStandIn();
  const title = `Invented Lighthouse Almanac ${Date.now()}`;
  const book = await seedBook("bt-test-alice", title);
  try {
    await routeStack(page);
    await signInAs(page, "bt-test-alice");
    await page.goto("/");
    await page.getByRole("link", { name: title, exact: true }).click();
    await page.locator("input[type=file]").setInputFiles({
      name: "page.png",
      mimeType: "image/png",
      buffer: pngBytes,
    });

    await page
      .getByText("Nobody asked him why. The sea, he said, kept")
      .click();
    await page
      .getByText("better accounts than any bank in the valley.")
      .click();
    await page.getByLabel("Page number").fill("12");
    await page.getByRole("button", { name: "Save quote" }).click();
    await expect(page.getByText("Quote saved.")).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Quotes" }).getByText("Page 12"),
    ).toBeVisible();
    await page.unrouteAll({ behavior: "ignoreErrors" });
  } finally {
    await book.remove();
    await stand.stop();
  }
});
