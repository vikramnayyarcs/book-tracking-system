import { clerkSetup } from "@clerk/testing/playwright";

export default async function globalSetup() {
  const missing = [
    "DEV_CLERK_PUBLISHABLE_KEY",
    "CLERK_PUBLISHABLE_KEY",
    "CLERK_SECRET_KEY",
  ].filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(
      `Web E2E tests need ${missing.join(", ")}; without them the app shows the "not set up" fallback instead of sign-in.`,
    );
  }
  await clerkSetup();
}
