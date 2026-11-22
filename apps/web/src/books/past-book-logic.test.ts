import { describe, expect, it } from "vitest";
import { emptyDraft } from "./add-book-logic.ts";
import {
  describeFinish,
  parsePastFinish,
  pastBookBody,
  pastBookError,
  pastRating,
} from "./past-book-logic.ts";

const now = new Date(2026, 4, 10);

describe("parsePastFinish", () => {
  it("builds a month date on the first of the month", () => {
    expect(
      parsePastFinish({ precision: "month", year: "2019", month: "3" }, now),
    ).toEqual({ ok: true, finishedOn: "2019-03-01", precision: "month" });
  });

  it("builds a year-only date on 1 January and ignores the month", () => {
    expect(
      parsePastFinish({ precision: "year", year: "2015", month: "" }, now),
    ).toEqual({ ok: true, finishedOn: "2015-01-01", precision: "year" });
  });

  it("rejects a bad year, a missing month and a month past 12", () => {
    for (const input of [
      { precision: "year", year: "19", month: "" },
      { precision: "year", year: "1800", month: "" },
      { precision: "year", year: "2027", month: "" },
      { precision: "month", year: "2019", month: "" },
      { precision: "month", year: "2019", month: "13" },
      { precision: "month", year: "2019", month: "0" },
    ] as const) {
      expect(parsePastFinish(input, now).ok).toBe(false);
    }
  });

  it("rejects a month in the future but accepts this month", () => {
    expect(
      parsePastFinish({ precision: "month", year: "2026", month: "6" }, now).ok,
    ).toBe(false);
    expect(
      parsePastFinish({ precision: "month", year: "2026", month: "5" }, now).ok,
    ).toBe(true);
  });
});

describe("describeFinish", () => {
  it("names the month and year, or the year alone", () => {
    expect(describeFinish("2019-03-01", "month")).toBe("March 2019");
    expect(describeFinish("2015-01-01", "year")).toBe("2015");
  });
});

describe("pastBookBody", () => {
  it("marks the book finished and retrospective with its precision", () => {
    const body = pastBookBody(
      { ...emptyDraft, title: " Invented Almanac " },
      { finishedOn: "2019-03-01", precision: "month" },
    );
    expect(body).toMatchObject({
      title: "Invented Almanac",
      status: "finished",
      finishedOn: "2019-03-01",
      finishedPrecision: "month",
      addedRetrospectively: true,
    });
  });
});

describe("pastBookError and pastRating", () => {
  it("checks the title first, then the date", () => {
    const finish = { precision: "year", year: "2015", month: "" } as const;
    expect(pastBookError(emptyDraft, finish, now)).toBe("Enter a title.");
    expect(
      pastBookError({ ...emptyDraft, title: "A" }, finish, now),
    ).toBeNull();
    expect(
      pastBookError(
        { ...emptyDraft, title: "A" },
        { ...finish, year: "x" },
        now,
      ),
    ).toContain("four digits");
  });

  it("treats no choice as no rating", () => {
    expect(pastRating("")).toBeNull();
    expect(pastRating("4")).toBe(4);
  });
});
