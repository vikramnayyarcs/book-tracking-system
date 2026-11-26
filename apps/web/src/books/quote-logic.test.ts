import { describe, expect, it } from "vitest";
import { checkQuote, parseQuotePage, passageFrom } from "./quote-logic.ts";

const lines = ["The sea, he said, kept", "better accounts than", "any bank."];

describe("parseQuotePage", () => {
  it("accepts whole numbers of 1 or more", () => {
    expect(parseQuotePage(" 12 ")).toBe(12);
    expect(parseQuotePage("1")).toBe(1);
  });
  it("rejects empty, zero, negative and decimal input", () => {
    const bad = ["", "0", "-3", "1.5", "12a", "9".repeat(20)];
    expect(bad.map(parseQuotePage)).toEqual(bad.map(() => null));
  });
});

describe("passageFrom", () => {
  it("joins the selected lines in page order", () => {
    expect(passageFrom(lines, ["2", "0"])).toBe(
      "The sea, he said, kept any bank.",
    );
  });
  it("is empty when nothing is selected", () => {
    expect(passageFrom(lines, [])).toBe("");
  });
});

describe("checkQuote", () => {
  it("returns the text and page", () => {
    expect(checkQuote(lines, ["0", "1"], "12")).toEqual({
      text: "The sea, he said, kept better accounts than",
      page: 12,
    });
  });
  it("explains a missing selection and a bad page", () => {
    expect(checkQuote(lines, [], "12")).toEqual({
      error: "Select at least one line.",
    });
    expect(checkQuote(lines, ["0"], "x")).toEqual({
      error: "Enter the page number as a whole number, 1 or more.",
    });
  });
  it("refuses a passage over 5000 characters", () => {
    const long = ["a".repeat(3000), "b".repeat(3000)];
    expect(checkQuote(long, ["0", "1"], "1")).toHaveProperty("error");
  });
});
