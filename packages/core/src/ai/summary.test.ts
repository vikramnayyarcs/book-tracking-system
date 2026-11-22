import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { maySummarize } from "../limits.ts";
import { groqText } from "./groq.ts";
import { parseSummary, summarizeNotes } from "./summary.ts";
import chat from "./fixtures/groq-chat-summary.json" with { type: "json" };

const server = setupServer(
  http.post("https://api.groq.com/openai/v1/chat/completions", () =>
    HttpResponse.json(chat),
  ),
);
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterAll(() => server.close());

describe("book summary", () => {
  it("writes a summary from a recorded response", async () => {
    const model = groqText({ apiKey: "test", model: "recorded" });
    const result = await summarizeNotes(
      model,
      { title: "Invented", author: null },
      ["an invented note"],
    );
    expect(result.summary).toContain("pear orchard");
    expect(result.usage.inputTokens).toBeGreaterThan(0);
  });

  it("trims the summary and rejects empty, missing or huge ones", () => {
    expect(parseSummary({ summary: "  Fine.  " })).toBe("Fine.");
    expect(() => parseSummary({ summary: "  " })).toThrow("ai_bad_output");
    expect(() => parseSummary({})).toThrow("ai_bad_output");
    expect(() => parseSummary(null)).toThrow("ai_bad_output");
    expect(() => parseSummary({ summary: "x".repeat(3001) })).toThrow(
      "ai_bad_output",
    );
  });

  it("is a Plus feature only", () => {
    expect(maySummarize("plus")).toBe(true);
    expect(maySummarize("free")).toBe(false);
  });
});
