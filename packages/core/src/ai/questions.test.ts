import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { groqText } from "./groq.ts";
import { askReflectionQuestions, parseQuestions } from "./questions.ts";
import chat from "./fixtures/groq-chat-questions.json" with { type: "json" };
import {
  parseReflectionAnswer,
  parseReflectionCreate,
} from "../reflections.ts";

const server = setupServer(
  http.post("https://api.groq.com/openai/v1/chat/completions", () =>
    HttpResponse.json(chat),
  ),
);
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterAll(() => server.close());

describe("reflection questions", () => {
  it("asks 3 questions from a recorded response", async () => {
    const model = groqText({ apiKey: "test", model: "recorded" });
    const result = await askReflectionQuestions(
      model,
      "end",
      { title: "Invented", author: null },
      ["an invented note"],
    );
    expect(result.questions).toHaveLength(3);
    expect(result.usage.inputTokens).toBeGreaterThan(0);
  });

  it("rejects fewer than 3 questions and trims extra ones", () => {
    expect(() => parseQuestions({ questions: [{ text: "a" }] })).toThrow(
      "ai_bad_output",
    );
    const five = Array.from({ length: 5 }, (_, i) => ({ text: ` q${i} ` }));
    expect(parseQuestions({ questions: five })).toEqual(["q0", "q1", "q2"]);
  });
});

describe("reflection input", () => {
  it("accepts only mid or end", () => {
    expect(parseReflectionCreate({ stage: "mid" })).toEqual({
      ok: true,
      stage: "mid",
    });
    expect(parseReflectionCreate({ stage: "recall" }).ok).toBe(false);
    expect(parseReflectionCreate({ stage: "end", extra: 1 }).ok).toBe(false);
  });

  it("accepts text or null as an answer", () => {
    expect(parseReflectionAnswer({ answer: null }).ok).toBe(true);
    expect(parseReflectionAnswer({ answer: "x".repeat(5001) }).ok).toBe(false);
    expect(parseReflectionAnswer({ answer: 3 }).ok).toBe(false);
  });
});
