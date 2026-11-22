import { readQuotePageV1 } from "../../prompts/read-quote-page.v1.ts";
import { AiError, type VisionModel } from "./types.ts";

export const MAX_OCR_LINES = 200;
export const MAX_OCR_LINE_LENGTH = 500;

export const parseLines = (json: unknown) => {
  const list = (json as { lines?: unknown } | null)?.lines;
  if (!Array.isArray(list) || list.some((line) => typeof line !== "string")) {
    throw new AiError("ai_bad_output");
  }
  return (list as string[])
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, MAX_OCR_LINES)
    .map((line) => line.slice(0, MAX_OCR_LINE_LENGTH));
};

export const readPageLines = async (model: VisionModel, image: Blob) => {
  const { json, usage } = await model.readLines({
    system: readQuotePageV1.system,
    user: readQuotePageV1.user,
    image,
  });
  return { lines: parseLines(json), usage };
};
