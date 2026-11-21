import { describe, expect, it } from "vitest";
import { lintScript, splitSentences } from "./lint-script.ts";

describe("lintScript", () => {
  it("accepts short single-instruction sentences", () => {
    expect(
      lintScript("Open the page. Read the heading. Select the link."),
    ).toEqual([]);
  });

  it("rejects a sentence of more than 20 words", () => {
    const long = `${Array.from({ length: 21 }, () => "word").join(" ")}.`;
    expect(lintScript(long)).toHaveLength(1);
  });

  it("accepts a sentence of exactly 20 words", () => {
    const exact = `${Array.from({ length: 20 }, () => "word").join(" ")}.`;
    expect(lintScript(exact)).toEqual([]);
  });

  it.each([
    "Open the page; read the heading.",
    "Open the page and then read the heading.",
    "Open the page, then read the heading.",
  ])("rejects several instructions in one sentence: %s", (text) => {
    expect(lintScript(text)).toHaveLength(1);
  });

  it("rejects contractions", () => {
    expect(lintScript("Do not worry. It doesn't change data.")).toHaveLength(1);
  });

  it("rejects questions", () => {
    expect(lintScript("Is the site private?")).toHaveLength(1);
  });

  it("allows a possessive", () => {
    expect(lintScript("The user's notes stay private.")).toEqual([]);
  });
});

describe("splitSentences", () => {
  it("splits on full stops across lines", () => {
    expect(splitSentences("One two.\nThree four. Five.")).toEqual([
      "One two.",
      "Three four.",
      "Five.",
    ]);
  });
});
