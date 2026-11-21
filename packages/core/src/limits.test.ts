import { describe, expect, it } from "vitest";
import { mayAskVault, mayTranscribe } from "./limits.ts";
import { parseTier, PLANS } from "./plans.ts";

const none = { voiceSeconds: 0, vaultQuestions: 0 };
const base = {
  usage: none,
  noteSeconds: 60,
  booksWithVoice: 0,
  bookAlreadyHasVoice: false,
};

describe("mayTranscribe", () => {
  it("allows a short note on a fresh free account", () => {
    expect(mayTranscribe({ ...base, tier: "free" })).toEqual({
      allowed: true,
      warn: false,
    });
  });

  it("rejects a note longer than the tier allows", () => {
    expect(mayTranscribe({ ...base, tier: "free", noteSeconds: 181 })).toEqual({
      allowed: false,
      reason: "note_too_long",
    });
    expect(mayTranscribe({ ...base, tier: "plus", noteSeconds: 181 })).toEqual({
      allowed: true,
      warn: false,
    });
    expect(mayTranscribe({ ...base, tier: "plus", noteSeconds: 601 })).toEqual({
      allowed: false,
      reason: "note_too_long",
    });
  });

  it("limits free voice to the first 3 books but not a book already using voice", () => {
    const full = { ...base, tier: "free" as const, booksWithVoice: 3 };
    expect(mayTranscribe(full)).toEqual({
      allowed: false,
      reason: "voice_book_limit",
    });
    expect(mayTranscribe({ ...full, bookAlreadyHasVoice: true })).toEqual({
      allowed: true,
      warn: false,
    });
    expect(mayTranscribe({ ...full, tier: "plus" })).toEqual({
      allowed: true,
      warn: false,
    });
  });

  it("rejects a note that would pass the monthly minutes", () => {
    const usage = {
      ...none,
      voiceSeconds: PLANS.free.voiceSecondsPerMonth - 59,
    };
    expect(mayTranscribe({ ...base, tier: "free", usage })).toEqual({
      allowed: false,
      reason: "voice_minutes_limit",
    });
  });

  it("allows a note that exactly reaches the limit and warns", () => {
    const usage = {
      ...none,
      voiceSeconds: PLANS.free.voiceSecondsPerMonth - 60,
    };
    expect(mayTranscribe({ ...base, tier: "free", usage })).toEqual({
      allowed: true,
      warn: true,
    });
  });

  it("warns from 80% of the monthly minutes", () => {
    const at80 = PLANS.free.voiceSecondsPerMonth * 0.8;
    expect(
      mayTranscribe({
        ...base,
        tier: "free",
        usage: { ...none, voiceSeconds: at80 - 60 },
      }),
    ).toEqual({ allowed: true, warn: true });
    expect(
      mayTranscribe({
        ...base,
        tier: "free",
        usage: { ...none, voiceSeconds: at80 - 61 },
      }),
    ).toEqual({ allowed: true, warn: false });
  });
});

describe("mayAskVault", () => {
  it("allows questions until the monthly cap, warning at 80%", () => {
    expect(
      mayAskVault({ tier: "free", usage: { ...none, vaultQuestions: 2 } }),
    ).toEqual({ allowed: true, warn: false });
    expect(
      mayAskVault({ tier: "free", usage: { ...none, vaultQuestions: 3 } }),
    ).toEqual({ allowed: true, warn: true });
    expect(
      mayAskVault({ tier: "free", usage: { ...none, vaultQuestions: 5 } }),
    ).toEqual({ allowed: false, reason: "vault_questions_limit" });
  });

  it("gives plus 200 questions", () => {
    expect(
      mayAskVault({ tier: "plus", usage: { ...none, vaultQuestions: 199 } }),
    ).toEqual({ allowed: true, warn: true });
    expect(
      mayAskVault({ tier: "plus", usage: { ...none, vaultQuestions: 200 } }),
    ).toEqual({ allowed: false, reason: "vault_questions_limit" });
  });
});

describe("parseTier", () => {
  it("accepts known tiers and rejects anything else", () => {
    expect(parseTier("plus")).toBe("plus");
    expect(parseTier("free")).toBe("free");
    expect(parseTier("gold")).toBeUndefined();
    expect(parseTier(undefined)).toBeUndefined();
  });
});
