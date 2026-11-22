import { bookSummaryV1 } from "../../prompts/book-summary.v1.ts";
import { AiError, type TextModel } from "./types.ts";

export const MAX_SUMMARY_CHARS = 3000;

export const parseSummary = (json: unknown) => {
  const summary = (json as { summary?: unknown } | null)?.summary;
  if (typeof summary !== "string") {
    throw new AiError("ai_bad_output");
  }
  const trimmed = summary.trim();
  if (trimmed === "" || trimmed.length > MAX_SUMMARY_CHARS) {
    throw new AiError("ai_bad_output");
  }
  return trimmed;
};

export const summarizeNotes = async (
  model: TextModel,
  book: { title: string; author: string | null },
  notes: string[],
) => {
  const { json, usage } = await model.completeJson({
    system: bookSummaryV1.system,
    user: bookSummaryV1.user(book, notes),
  });
  return { summary: parseSummary(json), usage };
};
