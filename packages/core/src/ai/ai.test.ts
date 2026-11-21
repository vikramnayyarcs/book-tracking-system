import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { groqSpeech, groqText } from "./groq.ts";
import { extractInsights, parseExtraction } from "./insights.ts";
import chat from "./fixtures/groq-chat-extraction.json" with { type: "json" };
import transcription from "./fixtures/groq-transcription.json" with { type: "json" };

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const book = { title: "The Lighthouse Keeper's Almanac", author: null };

describe("groq clients", () => {
  it("extracts insights and quotes from a recorded response", async () => {
    server.use(
      http.post("https://api.groq.com/openai/v1/chat/completions", () =>
        HttpResponse.json(chat),
      ),
    );
    const model = groqText({ apiKey: "test", model: "m" });
    const result = await extractInsights(model, "invented note", book);
    expect(result.insights).toHaveLength(3);
    expect(result.quotes).toEqual([
      { text: "A tide table is a promise the sea never made.", page: 41 },
    ]);
    expect(result.usage.inputTokens).toBeGreaterThan(0);
    expect(result.promptVersion).toBe(1);
  });

  it("transcribes with a recorded response", async () => {
    server.use(
      http.post("https://api.groq.com/openai/v1/audio/transcriptions", () =>
        HttpResponse.json(transcription),
      ),
    );
    const stt = groqSpeech({ apiKey: "test" });
    const out = await stt.transcribe(new Blob(["x"]), "note.m4a");
    expect(out.text).toBe(transcription.text);
  });

  it("maps 429 to ai_rate_limited and 500 to ai_provider_error", async () => {
    const model = groqText({ apiKey: "test", model: "m" });
    server.use(
      http.post(
        "https://api.groq.com/openai/v1/chat/completions",
        () => new HttpResponse(null, { status: 429 }),
      ),
    );
    await expect(
      model.completeJson({ system: "s", user: "u" }),
    ).rejects.toMatchObject({ code: "ai_rate_limited" });
    server.use(
      http.post(
        "https://api.groq.com/openai/v1/chat/completions",
        () => new HttpResponse(null, { status: 500 }),
      ),
    );
    await expect(
      model.completeJson({ system: "s", user: "u" }),
    ).rejects.toMatchObject({ code: "ai_provider_error" });
  });

  it("rejects content that is not JSON", async () => {
    server.use(
      http.post("https://api.groq.com/openai/v1/chat/completions", () =>
        HttpResponse.json({ choices: [{ message: { content: "no json" } }] }),
      ),
    );
    const model = groqText({ apiKey: "test", model: "m" });
    await expect(
      model.completeJson({ system: "s", user: "u" }),
    ).rejects.toMatchObject({ code: "ai_bad_output" });
  });
});

describe("parseExtraction", () => {
  it("keeps at most 5 insights and drops blanks", () => {
    const insights = Array.from({ length: 8 }, (_, i) => ({ text: ` t${i} ` }));
    const out = parseExtraction({
      insights: [{ text: "  " }, ...insights],
      quotes: [],
    });
    expect(out.insights).toHaveLength(5);
    expect(out.insights[0]?.text).toBe("t0");
  });

  it("keeps only positive integer pages", () => {
    const out = parseExtraction({
      insights: [{ text: "a" }],
      quotes: [
        { text: "q1", page: 3 },
        { text: "q2", page: -1 },
        { text: "q3", page: 2.5 },
        { text: "", page: 4 },
      ],
    });
    expect(out.quotes).toEqual([
      { text: "q1", page: 3 },
      { text: "q2", page: null },
      { text: "q3", page: null },
    ]);
  });

  it("rejects output with no insights", () => {
    expect(() => parseExtraction({ insights: [] })).toThrow("ai_bad_output");
    expect(() => parseExtraction(null)).toThrow("ai_bad_output");
    expect(() => parseExtraction({ quotes: [] })).toThrow("ai_bad_output");
  });
});
