export const TIERS = ["free", "plus"] as const;

export type Tier = (typeof TIERS)[number];

export const PLANS = {
  free: {
    voiceBooks: 3,
    voiceSecondsPerMonth: 60 * 60,
    longestNoteSeconds: 3 * 60,
    vaultQuestionsPerMonth: 5,
    bookSummary: false,
    keepAudio: false,
  },
  plus: {
    voiceBooks: Number.POSITIVE_INFINITY,
    voiceSecondsPerMonth: 10 * 60 * 60,
    longestNoteSeconds: 10 * 60,
    vaultQuestionsPerMonth: 200,
    bookSummary: true,
    keepAudio: true,
  },
} as const satisfies Record<Tier, Record<string, number | boolean>>;

export const WARNING_RATIO = 0.8;

export const parseTier = (value: string | undefined) =>
  TIERS.find((tier) => tier === value);
