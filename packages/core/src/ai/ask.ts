import { askVaultV1, type AskNote } from "../../prompts/ask-vault.v1.ts";
import { AiError, type TextModel } from "./types.ts";

export const NOT_IN_NOTES = "This is not in your notes.";

const squash = (value: string) =>
  value.toLowerCase().replace(/\s+/g, " ").trim();

export const MAX_CLAIMS = 5;

export const parseAnswer = (json: unknown, notes: { text: string }[]) => {
  const claims = (json as { claims?: unknown } | null)?.claims;
  if (!Array.isArray(claims)) throw new AiError("ai_bad_output");
  const kept: { text: string; note: number }[] = [];
  for (const item of claims.slice(0, MAX_CLAIMS)) {
    const { text, note, evidence } = (item ?? {}) as Record<string, unknown>;
    if (
      typeof text !== "string" ||
      typeof evidence !== "string" ||
      typeof note !== "number" ||
      !Number.isInteger(note)
    ) {
      continue;
    }
    const source = notes[note - 1];
    const proof = squash(evidence);
    if (
      source === undefined ||
      text.trim() === "" ||
      proof.length < 3 ||
      !squash(source.text).includes(proof)
    ) {
      continue;
    }
    const sentence = text.trim().replace(/[.\s]+$/, "");
    kept.push({
      text: `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}`,
      note,
    });
  }
  if (kept.length === 0) return { found: false } as const;
  return {
    found: true,
    answer: kept.map((claim) => `${claim.text} [${claim.note}].`).join(" "),
    cited: [...new Set(kept.map((claim) => claim.note))],
  } as const;
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
  return { parsed: parseAnswer(json, notes), usage };
};
