import { describe, expect, it } from "vitest";
import { checkPublishableKey } from "./publishable-key.ts";

const key = (host: string, prefix = "pk_test_") =>
  `${prefix}${Buffer.from(`${host}$`).toString("base64")}`;

describe("checkPublishableKey", () => {
  it("accepts a key from the same Clerk instance as the frontend API URL", () => {
    expect(
      checkPublishableKey(
        key("lucky-cat-1.clerk.accounts.dev"),
        "https://lucky-cat-1.clerk.accounts.dev",
      ),
    ).toEqual([]);
  });

  it("flags a key from a different Clerk instance", () => {
    const findings = checkPublishableKey(
      key("other-dog-2.clerk.accounts.dev"),
      "https://lucky-cat-1.clerk.accounts.dev",
    );
    expect(findings.join(" ")).toContain("different Clerk instance");
  });

  it("flags an empty key", () => {
    expect(
      checkPublishableKey("", "https://lucky-cat-1.clerk.accounts.dev").length,
    ).toBeGreaterThan(0);
  });

  it("flags a live key in the dev build", () => {
    const findings = checkPublishableKey(
      key("lucky-cat-1.clerk.accounts.dev", "pk_live_"),
      "https://lucky-cat-1.clerk.accounts.dev",
    );
    expect(findings.join(" ")).toContain("pk_test_");
  });

  it("flags a key that does not decode to a host", () => {
    const findings = checkPublishableKey(
      "pk_test_not-base64!!",
      "https://lucky-cat-1.clerk.accounts.dev",
    );
    expect(findings.length).toBeGreaterThan(0);
  });
});
