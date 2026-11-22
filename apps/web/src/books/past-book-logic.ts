import type { components } from "@book-tracking-system/api-contract/types";
import { type Draft, draftError, bookBody } from "./add-book-logic.ts";
import { parseRating } from "./book-logic.ts";

type BookCreate = components["schemas"]["BookCreate"];

export type FinishPrecision = "month" | "year";

export const MIN_YEAR = 1900;

export interface PastFinish {
  precision: FinishPrecision;
  year: string;
  month: string;
}

export type PastFinishResult =
  | { ok: true; finishedOn: string; precision: FinishPrecision }
  | { ok: false; error: string };

const pad = (n: number) => String(n).padStart(2, "0");

const monthError = {
  ok: false,
  error: "Enter the month as a number from 1 to 12.",
} satisfies PastFinishResult;

export function parsePastFinish(input: PastFinish, now: Date) {
  const yearText = input.year.trim();
  if (!/^\d{4}$/.test(yearText)) {
    return {
      ok: false,
      error: "Enter the year as four digits, for example 2019.",
    } satisfies PastFinishResult;
  }
  const year = Number(yearText);
  const thisYear = now.getFullYear();
  if (year < MIN_YEAR || year > thisYear) {
    return {
      ok: false,
      error: `Enter a year from ${MIN_YEAR} to ${thisYear}.`,
    } satisfies PastFinishResult;
  }
  if (input.precision === "year") {
    return {
      ok: true,
      finishedOn: `${yearText}-01-01`,
      precision: "year",
    } satisfies PastFinishResult;
  }
  const monthText = input.month.trim();
  if (!/^\d{1,2}$/.test(monthText)) return monthError;
  const month = Number(monthText);
  if (month < 1 || month > 12) return monthError;
  if (year === thisYear && month > now.getMonth() + 1) {
    return {
      ok: false,
      error: "That month has not happened yet.",
    } satisfies PastFinishResult;
  }
  return {
    ok: true,
    finishedOn: `${yearText}-${pad(month)}-01`,
    precision: "month",
  } satisfies PastFinishResult;
}

export function describeFinish(finishedOn: string, precision: FinishPrecision) {
  const [year = "", month = ""] = finishedOn.split("-");
  if (precision === "year") return year;
  const name = new Date(
    Date.UTC(Number(year), Number(month) - 1, 1),
  ).toLocaleString("en-GB", { month: "long", timeZone: "UTC" });
  return `${name} ${year}`;
}

export function pastBookBody(
  draft: Draft,
  finish: { finishedOn: string; precision: FinishPrecision },
) {
  const body: BookCreate = {
    ...bookBody(draft),
    status: "finished",
    finishedOn: finish.finishedOn,
    finishedPrecision: finish.precision,
    addedRetrospectively: true,
  };
  return body;
}

export function pastBookError(draft: Draft, finish: PastFinish, now: Date) {
  const problem = draftError(draft);
  if (problem) return problem;
  const parsed = parsePastFinish(finish, now);
  return parsed.ok ? null : parsed.error;
}

export function pastRating(value: string) {
  return value === "" ? null : parseRating(value);
}
