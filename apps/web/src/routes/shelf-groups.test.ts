import { describe, expect, it } from "vitest";
import { type Book, groupShelf, statusPatch } from "./shelf-groups.ts";

function book(over: Partial<Book>) {
  return {
    id: "id",
    isbn: null,
    title: "T",
    author: null,
    coverUrl: null,
    pageCount: null,
    status: "reading",
    startedOn: null,
    finishedOn: null,
    finishedPrecision: null,
    addedRetrospectively: false,
    createdAt: "2026-01-01T00:00:00Z",
    ...over,
  } satisfies Book;
}

describe("groupShelf", () => {
  it("puts Reading first, then Finished by year newest first, then Abandoned", () => {
    const sections = groupShelf([
      book({ id: "a", status: "abandoned" }),
      book({
        id: "b",
        status: "finished",
        finishedOn: "2024-01-01",
        finishedPrecision: "year",
      }),
      book({ id: "c", status: "reading" }),
      book({
        id: "d",
        status: "finished",
        finishedOn: "2026-09-14",
        finishedPrecision: "day",
      }),
      book({
        id: "e",
        status: "finished",
        finishedOn: "2026-02-01",
        finishedPrecision: "month",
      }),
      book({ id: "f", status: "finished" }),
    ]);
    expect(sections.map((s) => s.heading)).toEqual([
      "Reading",
      "Finished 2026",
      "Finished 2024",
      "Finished, date unknown",
      "Abandoned",
    ]);
    expect(sections[1]?.books.map((b) => b.id)).toEqual(["d", "e"]);
  });

  it("returns no sections for an empty shelf", () => {
    expect(groupShelf([])).toEqual([]);
  });
});

describe("statusPatch", () => {
  it("dates a book finished today", () => {
    expect(statusPatch("reading", "finished", "2026-11-22")).toEqual({
      status: "finished",
      finishedOn: "2026-11-22",
      finishedPrecision: "day",
    });
  });
  it("clears the finish date when a book leaves Finished", () => {
    expect(statusPatch("finished", "reading", "2026-11-22")).toEqual({
      status: "reading",
      finishedOn: null,
      finishedPrecision: null,
    });
  });
  it("changes only the status otherwise", () => {
    expect(statusPatch("reading", "abandoned", "2026-11-22")).toEqual({
      status: "abandoned",
    });
  });
});
