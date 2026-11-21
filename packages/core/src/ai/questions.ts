import { reflectionQuestionsV1 } from "../../prompts/reflection-questions.v1.ts";
import { AiError, type TextModel } from "./types.ts";

export const QUESTION_COUNT = 3;

export const parseQuestions = (json: unknown) => {
  const list = (json as { questions?: unknown } | null)?.questions;
  if (!Array.isArray(list)) {
    throw new AiError("ai_bad_output");
  }
  const questions = list
    .map((item) => (item as { text?: unknown } | null)?.text)
    .filter((text): text is string => typeof text === "string")
    .map((text) => text.trim())
    .filter((text) => text.length > 0)
    .slice(0, QUESTION_COUNT);
  if (questions.length < QUESTION_COUNT) {
    throw new AiError("ai_bad_output");
  }
  return questions;
};

export const askReflectionQuestions = async (
  model: TextModel,
  stage: "mid" | "end",
  book: { title: string; author: string | null },
  notes: string[],
) => {
  const { json, usage } = await model.completeJson({
    system: reflectionQuestionsV1.system,
    user: reflectionQuestionsV1.user(stage, book, notes),
  });
  return { questions: parseQuestions(json), usage };
};
