import { describe, expect, it } from "vitest";
import { splitSnippet } from "./search-highlight.ts";

describe("splitSnippet", () => {
  it("marks bracketed matches", () => {
    expect(splitSnippet("a [b] c [d]")).toEqual([
      { text: "a ", match: false },
      { text: "b", match: true },
      { text: " c ", match: false },
      { text: "d", match: true },
    ]);
  });
  it("keeps text with no matches or an unclosed bracket", () => {
    expect(splitSnippet("plain")).toEqual([{ text: "plain", match: false }]);
    expect(splitSnippet("a [b")).toEqual([{ text: "a [b", match: false }]);
    expect(splitSnippet("")).toEqual([]);
  });
});
