import { describe, expect, it } from "vitest";
import { parseBookFields } from "./books.ts";

describe("parseBookFields", () => {
  it("accepts a new reading book", () => {
    expect(parseBookFields({ title: "Invented" }, "create")).toEqual({
      ok: true,
      fields: { title: "Invented" },
    });
  });

  it("accepts a past book with a finish date and precision", () => {
    const result = parseBookFields(
      {
        title: "Invented",
        status: "finished",
        finishedOn: "2024-03-01",
        finishedPrecision: "month",
        addedRetrospectively: true,
      },
      "create",
    );
    expect(result.ok).toBe(true);
  });

  it("rejects the cases the database would also reject", () => {
    const bad: unknown[] = [
      null,
      [],
      {},
      { title: "" },
      { title: "x", status: "done" },
      { title: "x", pageCount: 0 },
      { title: "x", pageCount: 1.5 },
      { title: "x", startedOn: "2024-02-30" },
      { title: "x", finishedOn: "2024-01-01" },
      { title: "x", finishedPrecision: "day" },
      { title: "x", unknown: 1 },
      { title: null },
    ];
    for (const body of bad) {
      expect(parseBookFields(body, "create").ok).toBe(false);
    }
  });

  it("allows null to clear a field on update, but not on create", () => {
    expect(parseBookFields({ author: null }, "update").ok).toBe(true);
    expect(parseBookFields({ title: "x", author: null }, "create").ok).toBe(
      false,
    );
  });

  it("needs finishedOn and finishedPrecision to change together on update", () => {
    expect(parseBookFields({ finishedOn: "2024-01-01" }, "update").ok).toBe(
      false,
    );
    expect(
      parseBookFields(
        { finishedOn: "2024-01-01", finishedPrecision: "day" },
        "update",
      ).ok,
    ).toBe(true);
    expect(
      parseBookFields({ finishedOn: null, finishedPrecision: null }, "update")
        .ok,
    ).toBe(true);
  });

  it("rejects an empty update", () => {
    expect(parseBookFields({}, "update").ok).toBe(false);
  });
});
