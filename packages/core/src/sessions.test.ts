import { describe, expect, it } from "vitest";
import {
  audioPath,
  mayUploadAudio,
  parseAudioUpload,
  parseSessionCreate,
  parseSessionUpdate,
} from "./sessions.ts";

const id = "7a3c5d52-4f55-4a52-9d8a-0b6d3a0e2f10";
const bookId = "1b0d0b84-5d0f-4a39-8f60-0f1a2b3c4d5e";

describe("session parsing", () => {
  it("accepts a minimal create body", () => {
    const parsed = parseSessionCreate({ id, bookId, date: "2026-03-01" });
    expect(parsed).toMatchObject({ ok: true });
  });

  it("rejects bad ids, dates, unknown fields and reversed pages", () => {
    expect(parseSessionCreate({ id: "x", bookId, date: "2026-03-01" }).ok).toBe(
      false,
    );
    expect(parseSessionCreate({ id, bookId, date: "2026-02-30" }).ok).toBe(
      false,
    );
    expect(parseSessionCreate({ id, bookId }).ok).toBe(false);
    expect(
      parseSessionCreate({ id, bookId, date: "2026-03-01", x: 1 }).ok,
    ).toBe(false);
    expect(
      parseSessionCreate({
        id,
        bookId,
        date: "2026-03-01",
        pageFrom: 9,
        pageTo: 3,
      }).ok,
    ).toBe(false);
  });

  it("allows null on update but not on create, and needs one field", () => {
    expect(parseSessionUpdate({ chapter: null }).ok).toBe(true);
    expect(
      parseSessionCreate({ id, bookId, date: "2026-03-01", chapter: null }).ok,
    ).toBe(false);
    expect(parseSessionUpdate({}).ok).toBe(false);
  });

  it("validates audio upload requests", () => {
    expect(parseAudioUpload({ durationSeconds: 30 })).toMatchObject({
      ok: true,
      extension: "m4a",
    });
    expect(parseAudioUpload({ durationSeconds: 0 }).ok).toBe(false);
    expect(parseAudioUpload({ durationSeconds: 5, extension: "exe" }).ok).toBe(
      false,
    );
  });
});

describe("audio limits", () => {
  it("uses the longest note of the tier", () => {
    expect(mayUploadAudio("free", 180)).toBe(true);
    expect(mayUploadAudio("free", 181)).toBe(false);
    expect(mayUploadAudio("plus", 600)).toBe(true);
    expect(mayUploadAudio("plus", 601)).toBe(false);
  });

  it("builds a path under the user's folder", () => {
    expect(audioPath("user_1", id, "mp3")).toBe(`user_1/${id}.mp3`);
  });
});
