import { extractInsightsV1 } from "../../prompts/extract-insights.v1.ts";
import { AiError, type TextModel } from "./types.ts";

export const MAX_INSIGHTS = 5;

export type ExtractedInsight = { text: string };
export type ExtractedQuote = { text: string; page: number | null };
export type Extraction = {
  insights: ExtractedInsight[];
  quotes: ExtractedQuote[];
};

const clean = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

export const parseExtraction = (json: unknown) => {
  if (typeof json !== "object" || json === null) {
    throw new AiError("ai_bad_output");
  }
  const { insights, quotes } = json as Record<string, unknown>;
  if (!Array.isArray(insights)) throw new AiError("ai_bad_output");
  const parsedInsights = insights
    .map((item) => clean((item as { text?: unknown } | null)?.text))
    .filter((text) => text.length > 0)
    .slice(0, MAX_INSIGHTS)
    .map((text) => ({ text }));
  if (parsedInsights.length === 0) throw new AiError("ai_bad_output");
  const parsedQuotes = (Array.isArray(quotes) ? quotes : [])
    .map((item) => {
      const { text, page } = (item ?? {}) as Record<string, unknown>;
      return {
        text: clean(text),
        page:
          typeof page === "number" && Number.isInteger(page) && page > 0
            ? page
            : null,
      };
    })
    .filter((quote) => quote.text.length > 0);
  return {
    insights: parsedInsights,
    quotes: parsedQuotes,
  } satisfies Extraction;
};

export const extractInsights = async (
  model: TextModel,
  note: string,
  book: { title: string; author: string | null },
) => {
  const { json, usage } = await model.completeJson({
    system: extractInsightsV1.system,
    user: extractInsightsV1.user(note, book),
  });
  return {
    ...parseExtraction(json),
    usage,
    promptVersion: extractInsightsV1.version,
  };
};
