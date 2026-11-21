import { AiError, type SpeechToText, type TextModel } from "./types.ts";

export const GROQ_URL = "https://api.groq.com/openai/v1";

export const SPEECH_MODEL = "whisper-large-v3-turbo";

type Options = { apiKey: string; fetch?: typeof fetch; baseUrl?: string };

const send = async (f: typeof fetch, url: string, init: RequestInit) => {
  try {
    return await f(url, init);
  } catch {
    throw new AiError("ai_provider_error");
  }
};

const failure = (status: number) =>
  new AiError(status === 429 ? "ai_rate_limited" : "ai_provider_error");

export const groqSpeech = ({
  apiKey,
  fetch: f = fetch,
  baseUrl = GROQ_URL,
}: Options) =>
  ({
    transcribe: async (audio: Blob, filename: string) => {
      const form = new FormData();
      form.set("file", audio, filename);
      form.set("model", SPEECH_MODEL);
      form.set("response_format", "json");
      const res = await send(f, `${baseUrl}/audio/transcriptions`, {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}` },
        body: form,
      });
      if (!res.ok) throw failure(res.status);
      const body = (await res.json()) as { text?: unknown };
      if (typeof body.text !== "string") throw new AiError("ai_bad_output");
      return { text: body.text };
    },
  }) satisfies SpeechToText;

export const groqText = ({
  apiKey,
  model,
  fetch: f = fetch,
  baseUrl = GROQ_URL,
}: Options & { model: string }) =>
  ({
    completeJson: async ({
      system,
      user,
    }: {
      system: string;
      user: string;
    }) => {
      const res = await send(f, `${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model,
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
      });
      if (!res.ok) throw failure(res.status);
      const body = (await res.json()) as {
        choices?: { message?: { content?: unknown } }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      const content = body.choices?.[0]?.message?.content;
      if (typeof content !== "string") throw new AiError("ai_bad_output");
      let json: unknown;
      try {
        json = JSON.parse(content);
      } catch {
        throw new AiError("ai_bad_output");
      }
      return {
        json,
        usage: {
          inputTokens: body.usage?.prompt_tokens ?? 0,
          outputTokens: body.usage?.completion_tokens ?? 0,
        },
      };
    },
  }) satisfies TextModel;
