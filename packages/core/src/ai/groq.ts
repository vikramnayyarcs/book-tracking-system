import { AiError, type SpeechToText, type TextModel } from "./types.ts";

const BASE = "https://api.groq.com/openai/v1";

export const SPEECH_MODEL = "whisper-large-v3-turbo";

type Options = { apiKey: string; fetch?: typeof fetch };

const failure = (status: number) =>
  new AiError(status === 429 ? "ai_rate_limited" : "ai_provider_error");

export const groqSpeech = ({ apiKey, fetch: f = fetch }: Options) =>
  ({
    transcribe: async (audio: Blob, filename: string) => {
      const form = new FormData();
      form.set("file", audio, filename);
      form.set("model", SPEECH_MODEL);
      form.set("response_format", "json");
      const res = await f(`${BASE}/audio/transcriptions`, {
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
}: Options & { model: string }) =>
  ({
    completeJson: async ({
      system,
      user,
    }: {
      system: string;
      user: string;
    }) => {
      const res = await f(`${BASE}/chat/completions`, {
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
