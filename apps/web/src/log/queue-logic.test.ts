import { describe, expect, it } from "vitest";
import {
  advance,
  classifyStatus,
  createEntry,
  dueEntries,
  fail,
  isDue,
  MAX_DELAY_MS,
  nextStep,
  retryDelayMs,
  retryNow,
  waitingSummary,
  type NewEntry,
  type QueueEntry,
} from "./queue-logic.ts";

const typed: NewEntry = {
  id: "11111111-1111-4111-8111-111111111111",
  bookId: "22222222-2222-4222-8222-222222222222",
  date: "2026-11-22",
  pageFrom: 10,
  pageTo: 20,
  chapter: null,
  noteText: "Invented note about tide tables.",
  audio: null,
};

const voice: NewEntry = {
  ...typed,
  noteText: null,
  audio: { blob: new Blob(["x"]), seconds: 5, extension: "webm" },
};

const walk = (start: QueueEntry) => {
  let entry = start;
  const seen = [entry.step];
  for (;;) {
    const next = advance(entry);
    if (!next) return seen;
    entry = next;
    seen.push(entry.step);
  }
};

describe("queue steps", () => {
  it("skips the audio steps for a typed note", () => {
    expect(walk(createEntry(typed, 0))).toEqual(["create", "process"]);
  });

  it("goes through the signed upload for a voice note", () => {
    expect(walk(createEntry(voice, 0))).toEqual([
      "create",
      "audio-url",
      "upload",
      "process",
    ]);
  });

  it("has no step after process", () => {
    const entry = { ...createEntry(typed, 0), step: "process" as const };
    expect(nextStep(entry)).toBeNull();
  });

  it("resets the attempts and error when a step succeeds", () => {
    const failed = fail(createEntry(typed, 0), "retry", "No connection", 0);
    const next = advance(failed);
    expect(next?.attempts).toBe(0);
    expect(next?.lastError).toBeNull();
  });
});

describe("retry timing", () => {
  it("doubles the delay and stops at the cap", () => {
    expect(retryDelayMs(1)).toBe(2000);
    expect(retryDelayMs(2)).toBe(4000);
    expect(retryDelayMs(3)).toBe(8000);
    expect(retryDelayMs(20)).toBe(MAX_DELAY_MS);
  });

  it("is due only once the next attempt time has passed", () => {
    const failed = fail(createEntry(typed, 1000), "retry", "Offline", 1000);
    expect(isDue(failed, 2999)).toBe(false);
    expect(isDue(failed, 3000)).toBe(true);
  });

  it("returns due entries oldest first", () => {
    const a = createEntry({ ...typed, id: "a" }, 300);
    const b = createEntry({ ...typed, id: "b" }, 100);
    const c = fail(createEntry({ ...typed, id: "c" }, 200), "retry", "x", 200);
    expect(dueEntries([a, b, c], 500).map((e) => e.id)).toEqual(["b", "a"]);
  });

  it("makes a rejected entry due again on retry now", () => {
    const failed = fail(createEntry(typed, 0), "reject", "Refused", 0);
    const again = retryNow(failed, 50);
    expect(isDue(again, 50)).toBe(true);
    expect(again.rejected).toBe(false);
  });
});

describe("failures", () => {
  it("retries rate limits and server errors", () => {
    for (const status of [408, 425, 429, 500, 502, 503]) {
      expect(classifyStatus(status)).toBe("retry");
    }
  });

  it("rejects other client errors", () => {
    for (const status of [400, 401, 403, 404, 409, 422]) {
      expect(classifyStatus(status)).toBe("reject");
    }
  });

  it("never retries a rejected entry on its own", () => {
    const rejected = fail(createEntry(typed, 0), "reject", "Refused", 0);
    expect(isDue(rejected, 10 ** 9)).toBe(false);
    expect(rejected.lastError).toBe("Refused");
  });

  it("asks for a new signed URL after a failed upload", () => {
    const uploading = {
      ...createEntry(voice, 0),
      step: "upload" as const,
      uploadUrl: "https://example.test/signed",
    };
    const failed = fail(uploading, "retry", "Upload failed", 0);
    expect(failed.step).toBe("audio-url");
    expect(failed.uploadUrl).toBeNull();
  });

  it("keeps the step for a failure outside the upload", () => {
    const failed = fail(createEntry(typed, 0), "retry", "Offline", 0);
    expect(failed.step).toBe("create");
    expect(failed.attempts).toBe(1);
  });

  it("counts waiting and rejected entries apart", () => {
    const waiting = createEntry(typed, 0);
    const rejected = fail(createEntry(typed, 0), "reject", "Refused", 0);
    expect(waitingSummary([waiting, waiting, rejected])).toEqual({
      waiting: 2,
      rejected: 1,
    });
  });
});
