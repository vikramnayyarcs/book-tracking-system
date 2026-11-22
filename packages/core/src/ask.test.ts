import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { askVaultV1 } from "../prompts/ask-vault.v1.ts";
import { NOT_IN_NOTES, parseAnswer } from "./ai/ask.ts";
import { groqText } from "./ai/groq.ts";
import chat from "./ai/fixtures/groq-chat-ask.json" with { type: "json" };
import {
  answerQuestion,
  orQuery,
  parseAsk,
  toVectorLiteral,
  type RetrievedNote,
} from "./ask.ts";

const server = setupServer(
  http.post("https://api.groq.com/openai/v1/chat/completions", () =>
    HttpResponse.json(chat),
  ),
);
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterAll(() => server.close());

const book = "0b1f3b9e-0000-4000-8000-000000000001";
const retrieved: RetrievedNote[] = [
  {
    insightId: "0b1f3b9e-0000-4000-8000-0000000000a1",
    bookId: book,
    bookTitle: "Invented ask test book",
    sessionId: "0b1f3b9e-0000-4000-8000-0000000000b1",
    sessionDate: "2026-03-01",
    text: "Zebrafinch songs are learned, not inherited.",
  },
  {
    insightId: "0b1f3b9e-0000-4000-8000-0000000000a2",
    bookId: book,
    bookTitle: "Invented ask test book",
    sessionId: null,
    sessionDate: null,
    text: "Orchard rows need two feet of space.",
  },
];

describe("parseAsk", () => {
  it("accepts a question with an optional book", () => {
    expect(parseAsk({ question: "  What about habits? " })).toEqual({
      ok: true,
      question: "What about habits?",
      bookId: undefined,
    });
    expect(parseAsk({ question: "q", bookId: book }).ok).toBe(true);
  });

  it("rejects bad bodies", () => {
    expect(parseAsk(undefined).ok).toBe(false);
    expect(parseAsk({}).ok).toBe(false);
    expect(parseAsk({ question: "   " }).ok).toBe(false);
    expect(parseAsk({ question: "x".repeat(501) }).ok).toBe(false);
    expect(parseAsk({ question: "q", bookId: "nope" }).ok).toBe(false);
    expect(parseAsk({ question: "q", extra: 1 }).ok).toBe(false);
  });
});

describe("retrieval helpers", () => {
  it("builds an OR query of distinct words, keeping only letters and digits", () => {
    expect(orQuery("What have I read about leadership, leadership?")).toBe(
      "what | have | read | about | leadership",
    );
    expect(orQuery("a ' ; & ! |")).toBe("");
    expect(orQuery("naïve café 42x")).toBe("naïve | café | 42x");
  });

  it("formats a vector literal", () => {
    expect(toVectorLiteral([1, 0.5, 0])).toBe("[1,0.5,0]");
  });
});

describe("parseAnswer", () => {
  const notes = [{ text: "Zebrafinch songs are learned." }];

  it("keeps claims whose evidence is in the cited note and builds citations", () => {
    expect(
      parseAnswer(
        {
          claims: [
            {
              text: "you noted songs are learned.",
              note: 1,
              evidence: "SONGS  are learned",
            },
          ],
        },
        notes,
      ),
    ).toEqual({
      found: true,
      answer: "You noted songs are learned [1].",
      cited: [1],
    });
  });

  it("drops invented evidence, bad note numbers and malformed claims", () => {
    const result = parseAnswer(
      {
        claims: [
          { text: "x", note: 1, evidence: "birds sing at dawn" },
          { text: "x", note: 2, evidence: "songs are learned" },
          { text: "x", note: 1.5, evidence: "songs are learned" },
          { text: "", note: 1, evidence: "songs are learned" },
          null,
        ],
      },
      notes,
    );
    expect(result).toEqual({ found: false });
  });

  it("treats no claims as not found and a missing claims list as bad output", () => {
    expect(parseAnswer({ claims: [] }, notes)).toEqual({ found: false });
    expect(() => parseAnswer({}, notes)).toThrow("ai_bad_output");
    expect(() => parseAnswer(null, notes)).toThrow("ai_bad_output");
  });
});

describe("answerQuestion", () => {
  const model = groqText({ apiKey: "test", model: "recorded" });

  it("answers from a recorded response and cites book and session", async () => {
    const { result, usage } = await answerQuestion(
      model,
      "How do zebrafinches get their songs?",
      retrieved,
    );
    expect(result.answered).toBe(true);
    expect(result.answer).toContain("[1]");
    expect(result.citations).toEqual([
      {
        insightId: retrieved[0]?.insightId,
        bookId: book,
        bookTitle: "Invented ask test book",
        sessionId: "0b1f3b9e-0000-4000-8000-0000000000b1",
        sessionDate: "2026-03-01",
      },
    ]);
    expect(usage.inputTokens).toBeGreaterThan(0);
  });

  it("says not in your notes without calling the model when nothing was retrieved", async () => {
    const { result, usage } = await answerQuestion(model, "anything", []);
    expect(result).toEqual({
      answered: false,
      answer: NOT_IN_NOTES,
      citations: [],
    });
    expect(usage).toEqual({ inputTokens: 0, outputTokens: 0 });
  });
});

describe("prompt", () => {
  it("numbers the notes and names the book and session", () => {
    const text = askVaultV1.user("Q?", [
      { n: 1, bookTitle: "B", sessionDate: "2026-01-02", text: "T" },
      { n: 2, bookTitle: "C", sessionDate: null, text: "U" },
    ]);
    expect(text).toContain("[1] Book: B | Session: 2026-01-02\nT");
    expect(text).toContain("[2] Book: C\nU");
  });
});
