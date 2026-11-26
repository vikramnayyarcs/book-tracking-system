import { describe, expect, it } from "vitest";
import {
  booksSummary,
  monthLabel,
  monthLong,
  percent,
  starsLabel,
  total,
} from "./stats-logic.ts";

describe("stats logic", () => {
  it("labels months", () => {
    expect(monthLabel("2026-03")).toBe("Mar");
    expect(monthLong("2026-03")).toBe("March 2026");
  });
  it("scales bars and handles zero", () => {
    expect(percent(2, 4)).toBe(50);
    expect(percent(0, 0)).toBe(0);
  });
  it("totals counts", () => {
    expect(total([{ count: 1 }, { count: 2 }])).toBe(3);
  });
  it("words singular and plural", () => {
    expect(starsLabel(1)).toBe("1 star");
    expect(starsLabel(4)).toBe("4 stars");
    expect(booksSummary(1)).toBe("1 book finished in the last 12 months.");
    expect(booksSummary(0)).toBe("0 books finished in the last 12 months.");
  });
});
