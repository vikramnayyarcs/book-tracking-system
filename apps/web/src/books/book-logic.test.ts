import { describe, expect, it } from "vitest";
import {
  checkPhoto,
  MAX_PHOTO_BYTES,
  parseRating,
  photoExtension,
  reflectionsFor,
  sessionLocation,
  splitInsights,
} from "./book-logic.ts";

const session = (over: Record<string, unknown>) =>
  ({
    chapter: null,
    pageFrom: null,
    pageTo: null,
    ...over,
  }) as Parameters<typeof sessionLocation>[0];

describe("photoExtension", () => {
  it("maps the three accepted types", () => {
    expect(photoExtension("image/jpeg")).toBe("jpg");
    expect(photoExtension("image/png")).toBe("png");
    expect(photoExtension("image/webp")).toBe("webp");
  });
  it("refuses other types", () => {
    expect(photoExtension("image/gif")).toBeNull();
    expect(photoExtension("")).toBeNull();
  });
});

describe("checkPhoto", () => {
  it("accepts a small jpeg", () => {
    expect(checkPhoto({ type: "image/jpeg", size: 1000 })).toBeNull();
  });
  it("refuses a wrong type and a large file", () => {
    expect(checkPhoto({ type: "image/gif", size: 10 })).toMatch(/JPEG/);
    expect(
      checkPhoto({ type: "image/png", size: MAX_PHOTO_BYTES + 1 }),
    ).toMatch(/3 MB/);
  });
});

describe("sessionLocation", () => {
  it("prefers the chapter", () => {
    expect(sessionLocation(session({ chapter: "Chapter 3" }))).toBe(
      "Chapter 3",
    );
  });
  it("shows a page range or a single page", () => {
    expect(sessionLocation(session({ pageFrom: 10, pageTo: 24 }))).toBe(
      "Pages 10 to 24",
    );
    expect(sessionLocation(session({ pageFrom: 5, pageTo: 5 }))).toBe("Page 5");
  });
  it("says so when there is no place", () => {
    expect(sessionLocation(session({}))).toBe("No place noted");
  });
});

describe("splitInsights", () => {
  it("separates quotes from insights and keeps order", () => {
    const items = [
      { id: "a", kind: "quote" },
      { id: "b", kind: "insight" },
      { id: "c", kind: "insight" },
    ] as Parameters<typeof splitInsights>[0];
    const { insights, quotes } = splitInsights(items);
    expect(insights.map((i) => i.id)).toEqual(["b", "c"]);
    expect(quotes.map((i) => i.id)).toEqual(["a"]);
  });
});

describe("reflectionsFor", () => {
  it("filters by stage and sorts by position", () => {
    const items = [
      { id: "1", stage: "end", position: 2 },
      { id: "2", stage: "mid", position: 1 },
      { id: "3", stage: "end", position: 1 },
    ] as Parameters<typeof reflectionsFor>[0];
    expect(reflectionsFor(items, "end").map((r) => r.id)).toEqual(["3", "1"]);
  });
});

describe("parseRating", () => {
  it("accepts 1 to 5 only", () => {
    expect(parseRating("1")).toBe(1);
    expect(parseRating("5")).toBe(5);
    expect(parseRating("0")).toBeNull();
    expect(parseRating("6")).toBeNull();
    expect(parseRating("")).toBeNull();
    expect(parseRating("2.5")).toBeNull();
  });
});
