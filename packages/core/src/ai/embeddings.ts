import { AiError, type Embedder } from "./types.ts";

type Options = { url: string; fetch?: typeof fetch };

export const httpEmbedder = ({
  url,
  fetch: f = (input, init) => fetch(input, init),
}: Options) =>
  ({
    embed: async (texts: string[]) => {
      let res: Response;
      try {
        res = await f(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ input: texts }),
        });
      } catch {
        throw new AiError("ai_provider_error");
      }
      if (!res.ok) {
        throw new AiError("ai_provider_error");
      }
      const body = (await res.json()) as { embeddings?: unknown };
      if (!Array.isArray(body.embeddings)) {
        throw new AiError("ai_bad_output");
      }
      return body.embeddings as number[][];
    },
  }) satisfies Embedder;
