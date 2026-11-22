import {
  AiError,
  type SpeechToText,
  type TextModel,
  type VisionModel,
} from "./types.ts";

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

const readCompletion = async (res: Response) => {
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
};

export const groqSpeech = ({
  apiKey,
  fetch: f = (input, init) => fetch(input, init),
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
  fetch: f = (input, init) => fetch(input, init),
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
      return readCompletion(res);
    },
  }) satisfies TextModel;

export const VISION_MAX_OUTPUT_TOKENS = 800;

const toBase64 = (bytes: Uint8Array) => {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
};

export const groqVision = ({
  apiKey,
  model,
  fetch: f = (input, init) => fetch(input, init),
  baseUrl = GROQ_URL,
}: Options & { model: string }) =>
  ({
    readLines: async ({ system, user, image }) => {
      const bytes = new Uint8Array(await image.arrayBuffer());
      const dataUrl = `data:${image.type};base64,${toBase64(bytes)}`;
      const res = await send(f, `${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model,
          temperature: 0,
          max_tokens: VISION_MAX_OUTPUT_TOKENS,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            {
              role: "user",
              content: [
                { type: "text", text: user },
                { type: "image_url", image_url: { url: dataUrl } },
              ],
            },
          ],
        }),
      });
      return readCompletion(res);
    },
  }) satisfies VisionModel;
