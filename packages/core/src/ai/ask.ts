import { askVaultV1, type AskNote } from "../../prompts/ask-vault.v1.ts";
import { AiError, type TextModel } from "./types.ts";

export const NOT_IN_NOTES = "This is not in your notes.";

export const parseAnswer = (json: unknown, noteCount: number) => {
  if (typeof json !== "object" || json === null) {
    throw new AiError("ai_bad_output");
  }
  const { found, answer, citations } = json as Record<string, unknown>;
  if (typeof found !== "boolean") throw new AiError("ai_bad_output");
  if (!found) return { found: false } as const;
  const text = typeof answer === "string" ? answer.trim() : "";
  const cited = Array.isArray(citations)
    ? [
        ...new Set(
          citations.filter(
            (n): n is number =>
              typeof n === "number" &&
              Number.isInteger(n) &&
              n >= 1 &&
              n <= noteCount,
          ),
        ),
      ]
    : [];
  if (text === "" || cited.length === 0) return { found: false } as const;
  return { found: true, answer: text, cited } as const;
};

export const answerFromNotes = async (
  model: TextModel,
  question: string,
  notes: AskNote[],
) => {
  const { json, usage } = await model.completeJson({
    system: askVaultV1.system,
    user: askVaultV1.user(question, notes),
  });
  return { parsed: parseAnswer(json, notes.length), usage };
};
