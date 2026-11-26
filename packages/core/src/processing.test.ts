import { describe, expect, it } from "vitest";
import {
  audioFitsDuration,
  MAX_AUDIO_BYTES_PER_SECOND,
  planProcessing,
  type ProcessInfo,
} from "./processing.ts";

const base = {
  id: "s",
  bookId: "b",
  status: "uploaded",
  noteText: null,
  audioPath: "u/s.m4a",
  audioSeconds: 60,
  bookTitle: "Invented",
  bookAuthor: null,
  voiceSecondsUsed: 0,
  booksWithVoice: 0,
  bookHasOtherVoice: false,
} satisfies ProcessInfo;

describe("planProcessing", () => {
  it("transcribes a voice session", () => {
    expect(planProcessing(base, "free")).toEqual({
      kind: "ready",
      transcribe: true,
    });
  });

  it("skips transcription when a note already exists", () => {
    expect(
      planProcessing({ ...base, noteText: "typed", audioPath: null }, "free"),
    ).toEqual({ kind: "ready", transcribe: false });
  });

  it("lets a failed session run again, but not one in progress or ready", () => {
    expect(planProcessing({ ...base, status: "failed" }, "free").kind).toBe(
      "ready",
    );
    for (const status of ["transcribing", "extracting", "ready"]) {
      expect(planProcessing({ ...base, status }, "free").kind).toBe("conflict");
    }
  });

  it("has nothing to process without a note or audio", () => {
    expect(
      planProcessing({ ...base, audioPath: null, audioSeconds: null }, "free"),
    ).toEqual({ kind: "nothing" });
  });

  it("denies the fourth voice book on free and a note over the limit", () => {
    expect(planProcessing({ ...base, booksWithVoice: 3 }, "free")).toEqual({
      kind: "denied",
      reason: "voice_book_limit",
    });
    expect(planProcessing({ ...base, audioSeconds: 181 }, "free")).toEqual({
      kind: "denied",
      reason: "note_too_long",
    });
  });

  it("denies when the monthly minutes run out", () => {
    expect(planProcessing({ ...base, voiceSecondsUsed: 3600 }, "free")).toEqual(
      { kind: "denied", reason: "voice_minutes_limit" },
    );
  });
});

describe("audioFitsDuration", () => {
  it("accepts a file that fits the declared length", () => {
    expect(audioFitsDuration(2048, 30)).toBe(true);
    expect(audioFitsDuration(MAX_AUDIO_BYTES_PER_SECOND * 60, 60)).toBe(true);
  });

  it("rejects a long recording declared as a short one", () => {
    expect(audioFitsDuration(MAX_AUDIO_BYTES_PER_SECOND * 60 + 1, 60)).toBe(
      false,
    );
    expect(audioFitsDuration(20 * 1024 * 1024, 1)).toBe(false);
  });

  it("rejects a missing or non-positive declared length", () => {
    expect(audioFitsDuration(1, null)).toBe(false);
    expect(audioFitsDuration(1, 0)).toBe(false);
  });
});
