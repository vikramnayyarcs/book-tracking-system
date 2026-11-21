import { describe, expect, it } from "vitest";
import { parseSearch } from "./search.ts";

describe("parseSearch", () => {
  it("trims the query and defaults the limit", () => {
    expect(parseSearch("  habits ", undefined)).toEqual({
      ok: true,
      query: "habits",
      limit: 20,
    });
  });

  it("rejects an empty or long query and a bad limit", () => {
    expect(parseSearch(undefined, undefined).ok).toBe(false);
    expect(parseSearch("   ", undefined).ok).toBe(false);
    expect(parseSearch("a".repeat(201), undefined).ok).toBe(false);
    expect(parseSearch("a", "0").ok).toBe(false);
    expect(parseSearch("a", "51").ok).toBe(false);
    expect(parseSearch("a", "x").ok).toBe(false);
    expect(parseSearch("a", "50")).toMatchObject({ ok: true, limit: 50 });
  });
});
