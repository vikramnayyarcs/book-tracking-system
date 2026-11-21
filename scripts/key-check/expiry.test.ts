import { describe, expect, it } from "vitest";
import { expiryReason, failedKeys, issueBody, toResult } from "./expiry.ts";

const now = new Date("2026-11-21T12:00:00Z");

describe("expiryReason", () => {
  it("passes when there is no expiry date", () => {
    expect(expiryReason(null, now)).toBeUndefined();
    expect(expiryReason(undefined, now)).toBeUndefined();
  });

  it("passes when the key expires after the window", () => {
    expect(expiryReason("2026-12-10T12:00:00Z", now)).toBeUndefined();
  });

  it("passes exactly 14 days out", () => {
    expect(expiryReason("2026-12-05T12:00:00Z", now)).toBeUndefined();
  });

  it("fails inside the window", () => {
    expect(expiryReason("2026-12-04T12:00:00Z", now)).toBe(
      "expires in 13 days",
    );
  });

  it("fails when expired", () => {
    expect(expiryReason("2026-11-20T00:00:00Z", now)).toBe("expired");
  });

  it("fails on an unreadable date", () => {
    expect(expiryReason("soon", now)).toBe("expiry date unreadable");
  });

  it("honours a custom window", () => {
    expect(expiryReason("2026-12-04T12:00:00Z", now, 7)).toBeUndefined();
  });
});

describe("report", () => {
  const results = [
    toResult("A_KEY", undefined),
    toResult("B_KEY", "rejected (401)"),
  ];

  it("keeps only failed keys", () => {
    expect(failedKeys(results).map((result) => result.name)).toEqual(["B_KEY"]);
  });

  it("names keys and reasons only", () => {
    expect(issueBody(failedKeys(results))).toContain(
      "- `B_KEY`: rejected (401)",
    );
  });
});
