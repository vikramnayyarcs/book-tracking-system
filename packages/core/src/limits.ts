import { PLANS, WARNING_RATIO, type Tier } from "./plans.ts";

export type Usage = {
  voiceSeconds: number;
  vaultQuestions: number;
};

export type LimitReason =
  | "note_too_long"
  | "voice_book_limit"
  | "voice_minutes_limit"
  | "vault_questions_limit";

export type Decision =
  { allowed: true; warn: boolean } | { allowed: false; reason: LimitReason };

const allow = (warn: boolean) =>
  ({ allowed: true, warn }) as const satisfies Decision;

const deny = (reason: LimitReason) =>
  ({ allowed: false, reason }) as const satisfies Decision;

const reaches = (used: number, limit: number) =>
  Number.isFinite(limit) && used >= limit * WARNING_RATIO;

export const mayTranscribe = (input: {
  tier: Tier;
  usage: Usage;
  noteSeconds: number;
  booksWithVoice: number;
  bookAlreadyHasVoice: boolean;
}) => {
  const plan = PLANS[input.tier];
  if (input.noteSeconds > plan.longestNoteSeconds) {
    return deny("note_too_long");
  }
  if (!input.bookAlreadyHasVoice && input.booksWithVoice >= plan.voiceBooks) {
    return deny("voice_book_limit");
  }
  const after = input.usage.voiceSeconds + input.noteSeconds;
  if (after > plan.voiceSecondsPerMonth) {
    return deny("voice_minutes_limit");
  }
  return allow(reaches(after, plan.voiceSecondsPerMonth));
};

export const mayAskVault = (input: { tier: Tier; usage: Usage }) => {
  const limit = PLANS[input.tier].vaultQuestionsPerMonth;
  if (input.usage.vaultQuestions >= limit) {
    return deny("vault_questions_limit");
  }
  return allow(reaches(input.usage.vaultQuestions + 1, limit));
};

export const maySummarize = (tier: Tier) => PLANS[tier].bookSummary;
