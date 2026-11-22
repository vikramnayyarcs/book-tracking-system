import { describe, expect, it } from "vitest";
import {
  clampSeconds,
  elapsedSeconds,
  formatClock,
  hasNote,
  isAtCap,
  MAX_RECORDING_SECONDS,
  parseLocation,
  pickAudioFormat,
} from "./form-logic.ts";

const pages = (pageFrom: string, pageTo: string) =>
  parseLocation({ mode: "pages", pageFrom, pageTo, chapter: "ignored" });

const chapter = (text: string) =>
  parseLocation({ mode: "chapter", pageFrom: "", pageTo: "", chapter: text });

describe("parseLocation", () => {
  it("reads a page range", () => {
    expect(pages(" 12 ", "30")).toEqual({
      ok: true,
      pageFrom: 12,
      pageTo: 30,
      chapter: null,
    });
  });

  it("accepts a single page", () => {
    expect(pages("5", "5").ok).toBe(true);
  });

  it("refuses a range that runs backwards", () => {
    expect(pages("30", "12").ok).toBe(false);
  });

  it("refuses empty, zero and non-numeric pages", () => {
    for (const [from, to] of [
      ["", "4"],
      ["0", "4"],
      ["a", "4"],
      ["1.5", "4"],
      ["-2", "4"],
    ] as const) {
      expect(pages(from, to).ok).toBe(false);
    }
  });

  it("reads a chapter and drops the pages", () => {
    expect(
      parseLocation({
        mode: "chapter",
        pageFrom: "1",
        pageTo: "2",
        chapter: "  Chapter 3  ",
      }),
    ).toEqual({ ok: true, pageFrom: null, pageTo: null, chapter: "Chapter 3" });
  });

  it("refuses a blank or very long chapter", () => {
    expect(chapter("   ").ok).toBe(false);
    expect(chapter("x".repeat(301)).ok).toBe(false);
  });
});

describe("recording timer", () => {
  it("counts whole seconds", () => {
    expect(elapsedSeconds(1000, 4999)).toBe(3);
  });

  it("stops counting at ten minutes", () => {
    expect(elapsedSeconds(0, 11 * 60 * 1000)).toBe(MAX_RECORDING_SECONDS);
    expect(isAtCap(MAX_RECORDING_SECONDS)).toBe(true);
    expect(isAtCap(MAX_RECORDING_SECONDS - 1)).toBe(false);
  });

  it("never goes below zero", () => {
    expect(elapsedSeconds(5000, 1000)).toBe(0);
  });

  it("formats minutes and seconds", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(65)).toBe("1:05");
    expect(formatClock(600)).toBe("10:00");
  });

  it("keeps the uploaded duration between 1 and 600 seconds", () => {
    expect(clampSeconds(0.2)).toBe(1);
    expect(clampSeconds(42.9)).toBe(42);
    expect(clampSeconds(9999)).toBe(MAX_RECORDING_SECONDS);
  });
});

describe("pickAudioFormat", () => {
  it("prefers m4a where the browser records it, as on iOS", () => {
    expect(pickAudioFormat(() => true)).toEqual({
      mimeType: "audio/mp4",
      extension: "m4a",
    });
  });

  it("falls back to webm on Chromium", () => {
    expect(pickAudioFormat((type) => type.startsWith("audio/webm"))).toEqual({
      mimeType: "audio/webm;codecs=opus",
      extension: "webm",
    });
  });

  it("returns null when nothing is supported", () => {
    expect(pickAudioFormat(() => false)).toBeNull();
  });
});

describe("hasNote", () => {
  it("needs a recording or non-blank text", () => {
    expect(hasNote("", false)).toBe(false);
    expect(hasNote("   ", false)).toBe(false);
    expect(hasNote("", true)).toBe(true);
    expect(hasNote("a thought", false)).toBe(true);
  });
});
