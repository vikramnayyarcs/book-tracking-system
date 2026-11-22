import { describe, expect, it } from "vitest";
import {
  bookBody,
  draftError,
  draftFrom,
  emptyDraft,
  parseIsbn,
  scannedIsbn,
} from "./add-book-logic.ts";

describe("add book logic", () => {
  it("accepts a valid ISBN with hyphens and rejects a bad one", () => {
    expect(parseIsbn("978-0-306-40615-7")).toBe("9780306406157");
    expect(parseIsbn("978-0-306-40615-8")).toBeUndefined();
  });

  it("picks the first valid ISBN from scanned codes", () => {
    expect(
      scannedIsbn([{ rawValue: "12345" }, { rawValue: "9780306406157" }]),
    ).toBe("9780306406157");
    expect(scannedIsbn([{ rawValue: "12345" }])).toBeUndefined();
  });

  it("builds a draft from a search result with null fields", () => {
    expect(
      draftFrom({
        isbn: null,
        title: "Invented Atlas",
        author: null,
        coverUrl: null,
        pageCount: 210,
      }),
    ).toEqual({ ...emptyDraft, title: "Invented Atlas", pageCount: "210" });
  });

  it("validates title and page count", () => {
    expect(draftError(emptyDraft)).toBe("Enter a title.");
    expect(draftError({ ...emptyDraft, title: "A", pageCount: "0" })).toMatch(
      /whole number/,
    );
    expect(draftError({ ...emptyDraft, title: "A", pageCount: "12" })).toBe(
      null,
    );
  });

  it("sends only the fields that have values, status reading", () => {
    expect(bookBody({ ...emptyDraft, title: " A ", pageCount: "12" })).toEqual({
      title: "A",
      status: "reading",
      pageCount: 12,
    });
  });
});
