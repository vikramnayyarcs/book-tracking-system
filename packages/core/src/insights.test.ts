import { describe, expect, it } from "vitest";
import { parseInsightCreate, parseInsightUpdate } from "./insights.ts";

describe("insight parsing", () => {
  it("accepts text with optional fields", () => {
    expect(parseInsightCreate({ text: "An invented thought" }).ok).toBe(true);
    expect(
      parseInsightCreate({
        text: "Quote",
        kind: "quote",
        page: 4,
        pinned: true,
      }).ok,
    ).toBe(true);
  });

  it("rejects empty text, bad kind, bad page, bad session id and unknown fields", () => {
    expect(parseInsightCreate({ text: "  " }).ok).toBe(false);
    expect(parseInsightCreate({ text: "a", kind: "note" }).ok).toBe(false);
    expect(parseInsightCreate({ text: "a", page: 0 }).ok).toBe(false);
    expect(parseInsightCreate({ text: "a", sessionId: "x" }).ok).toBe(false);
    expect(parseInsightCreate({ text: "a", source: "ai" }).ok).toBe(false);
  });

  it("needs at least one field to update and allows a null page", () => {
    expect(parseInsightUpdate({}).ok).toBe(false);
    expect(parseInsightUpdate({ page: null }).ok).toBe(true);
    expect(parseInsightUpdate({ pinned: true }).ok).toBe(true);
    expect(parseInsightUpdate({ original_text: "x" }).ok).toBe(false);
  });
});
