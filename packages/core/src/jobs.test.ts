import { describe, expect, it } from "vitest";
import { bucketRunKey, parseRunKey } from "./jobs.ts";

describe("bucketRunKey", () => {
  it("gives the same key inside one bucket and a new key in the next", () => {
    const start = Date.parse("2026-11-22T10:15:00Z");
    expect(bucketRunKey(start, 15)).toBe(bucketRunKey(start + 899_999, 15));
    expect(bucketRunKey(start, 15)).not.toBe(bucketRunKey(start + 900_000, 15));
  });
});

describe("parseRunKey", () => {
  it("accepts a plain key and refuses odd characters", () => {
    expect(parseRunKey("run-1")).toBe("run-1");
    expect(parseRunKey("a b")).toBeUndefined();
    expect(parseRunKey(undefined)).toBeUndefined();
  });
});
