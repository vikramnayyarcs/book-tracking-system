import { clerk } from "@clerk/testing/playwright";
import { expect, type Page } from "@playwright/test";
import { ensureUser } from "../api/clerk.ts";

export const signInAs = async (page: Page, externalId: string) => {
  await ensureUser(externalId);
  await page.goto("/sign-in");
  await clerk.signIn({ page, emailAddress: `${externalId}@example.com` });
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
};
