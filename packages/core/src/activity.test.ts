import { describe, expect, it } from "vitest";
import { parseYear } from "./activity.ts";

describe("parseYear", () => {
  it("accepts a four-digit year in range", () => {
    expect(parseYear("2026")).toBe(2026);
    expect(parseYear("1900")).toBe(1900);
  });

  it("rejects missing, malformed and out-of-range years", () => {
    expect(parseYear(undefined)).toBeUndefined();
    expect(parseYear("26")).toBeUndefined();
    expect(parseYear("2026.5")).toBeUndefined();
    expect(parseYear("1899")).toBeUndefined();
    expect(parseYear("2201")).toBeUndefined();
  });
});
