import { describe, expect, it } from "vitest";
import { buildYear, daySummary, longDate } from "./activity-logic.ts";

describe("buildYear", () => {
  it("builds twelve months with the right day counts", () => {
    const months = buildYear(2024, []);
    expect(months).toHaveLength(12);
    expect(months[1]?.days).toHaveLength(29);
    expect(months[0]?.name).toBe("January");
  });

  it("starts weeks on Monday", () => {
    expect(buildYear(2024, [])[0]?.blanks).toBe(0);
    expect(buildYear(2024, [])[8]?.blanks).toBe(6);
  });

  it("marks only the given dates", () => {
    const march = buildYear(2025, ["2025-03-03", "2025-03-05"])[2];
    expect(march?.days.filter((d) => d.active).map((d) => d.day)).toEqual([
      3, 5,
    ]);
  });
});

describe("text", () => {
  it("formats a date", () => {
    expect(longDate("2025-03-03")).toBe("March 3, 2025");
  });
  it("summarises without streak or gap wording", () => {
    expect(daySummary(0, 2025)).toBe("No entries in 2025 yet.");
    expect(daySummary(1, 2025)).toBe("1 day with an entry in 2025.");
    expect(daySummary(4, 2025)).toBe("4 days with an entry in 2025.");
  });
});
