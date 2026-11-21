import { describe, expect, it } from "vitest";
import { parseFinish, parsePhotoUpload, photoPath } from "./finish.ts";

describe("finish parsing", () => {
  it("accepts an empty body, a rating and a review", () => {
    expect(parseFinish({}).ok).toBe(true);
    expect(parseFinish({ rating: 5, review: "An invented review." }).ok).toBe(
      true,
    );
  });

  it("rejects bad ratings, dates, precision and unknown fields", () => {
    expect(parseFinish({ rating: 0 }).ok).toBe(false);
    expect(parseFinish({ rating: 6 }).ok).toBe(false);
    expect(parseFinish({ rating: 2.5 }).ok).toBe(false);
    expect(parseFinish({ finishedOn: "2026-13-01" }).ok).toBe(false);
    expect(parseFinish({ finishedPrecision: "week" }).ok).toBe(false);
    expect(parseFinish({ finishedPrecision: "year" }).ok).toBe(false);
    expect(parseFinish({ status: "reading" }).ok).toBe(false);
  });

  it("accepts a past finish date with precision", () => {
    expect(
      parseFinish({ finishedOn: "2024-06-01", finishedPrecision: "month" }).ok,
    ).toBe(true);
  });

  it("limits photo extensions and builds a path under the user's folder", () => {
    expect(parsePhotoUpload({ extension: "jpg" }).ok).toBe(true);
    expect(parsePhotoUpload({ extension: "gif" }).ok).toBe(false);
    expect(photoPath("user_1", "b1", "webp")).toBe("user_1/b1.webp");
  });
});
