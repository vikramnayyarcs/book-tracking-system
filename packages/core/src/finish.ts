import type { Sql } from "./api/db.ts";
import { PRECISIONS, getBook, updateBook, type Precision } from "./books.ts";

export const PHOTO_EXTENSIONS = ["jpg", "png", "webp"] as const;
export type PhotoExtension = (typeof PHOTO_EXTENSIONS)[number];

export type Review = {
  rating: number | null;
  text: string | null;
  summary: string | null;
  hasPhoto: boolean;
};

type ReviewRow = {
  rating: number | null;
  text: string | null;
  summary: string | null;
  photo_path: string | null;
};

export type FinishInput = {
  rating?: number;
  review?: string;
  finishedOn?: string;
  finishedPrecision?: Precision;
};

const toReview = (row: ReviewRow | undefined) =>
  ({
    rating: row?.rating ?? null,
    text: row?.text ?? null,
    summary: row?.summary ?? null,
    hasPhoto: row?.photo_path != null,
  }) satisfies Review;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isDate = (value: unknown) =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
  new Date(`${value}T00:00:00Z`).toISOString().startsWith(value);

const fail = (detail: string) => ({ ok: false, detail }) as const;

export const parseFinish = (input: unknown) => {
  if (!isRecord(input)) {
    return fail("Body must be a JSON object");
  }
  for (const key of Object.keys(input)) {
    if (
      !["rating", "review", "finishedOn", "finishedPrecision"].includes(key)
    ) {
      return fail(`Unknown field ${key}`);
    }
  }
  const finish: FinishInput = {};
  const { rating, review, finishedOn, finishedPrecision } = input;
  if (rating !== undefined) {
    if (
      typeof rating !== "number" ||
      !Number.isInteger(rating) ||
      rating < 1 ||
      rating > 5
    ) {
      return fail("rating must be a whole number from 1 to 5");
    }
    finish.rating = rating;
  }
  if (review !== undefined) {
    if (typeof review !== "string" || review.length > 20000) {
      return fail("Invalid review");
    }
    finish.review = review;
  }
  if (finishedOn !== undefined) {
    if (!isDate(finishedOn)) {
      return fail("Invalid finishedOn");
    }
    finish.finishedOn = finishedOn as string;
  }
  if (finishedPrecision !== undefined) {
    if (!(PRECISIONS as readonly unknown[]).includes(finishedPrecision)) {
      return fail("Invalid finishedPrecision");
    }
    finish.finishedPrecision = finishedPrecision as Precision;
  }
  if (
    (finish.finishedOn === undefined) !==
    (finish.finishedPrecision === undefined)
  ) {
    if (finish.finishedPrecision !== undefined) {
      return fail("finishedPrecision needs finishedOn");
    }
  }
  return { ok: true, finish } as const;
};

export const parsePhotoUpload = (input: unknown) => {
  if (!isRecord(input)) {
    return fail("Body must be a JSON object");
  }
  for (const key of Object.keys(input)) {
    if (key !== "extension") {
      return fail(`Unknown field ${key}`);
    }
  }
  const extension = input["extension"];
  if (!(PHOTO_EXTENSIONS as readonly unknown[]).includes(extension)) {
    return fail("extension must be jpg, png or webp");
  }
  return { ok: true, extension: extension as PhotoExtension } as const;
};

export const photoPath = (
  userId: string,
  bookId: string,
  extension: PhotoExtension,
) => `${userId}/${bookId}.${extension}`;

export const getReview = async (sql: Sql, bookId: string) => {
  if ((await getBook(sql, bookId)) === undefined) {
    return undefined;
  }
  const rows = await sql<ReviewRow[]>`
    select rating, text, summary, photo_path from app.reviews
    where book_id = ${bookId}
  `;
  return toReview(rows[0]);
};

export const finishBook = async (
  sql: Sql,
  bookId: string,
  input: FinishInput,
  today: string,
) => {
  const existing = await getBook(sql, bookId);
  if (existing === undefined) {
    return undefined;
  }
  const book = await updateBook(sql, bookId, {
    status: "finished",
    finishedOn: input.finishedOn ?? existing.finishedOn ?? today,
    finishedPrecision:
      input.finishedPrecision ?? existing.finishedPrecision ?? "day",
  });
  if (input.rating !== undefined || input.review !== undefined) {
    await sql`
      insert into app.reviews (book_id, rating, text)
      values (${bookId}, ${input.rating ?? null}, ${input.review ?? null})
      on conflict (book_id) do update set
        rating = coalesce(excluded.rating, app.reviews.rating),
        text = coalesce(excluded.text, app.reviews.text)
    `;
  }
  return { book, review: await getReview(sql, bookId) };
};

export const setFinishPhoto = async (
  sql: Sql,
  bookId: string,
  path: string,
) => {
  await sql`
    insert into app.reviews (book_id, photo_path) values (${bookId}, ${path})
    on conflict (book_id) do update set photo_path = excluded.photo_path
  `;
};

export const currentPhotoPath = async (sql: Sql, bookId: string) => {
  const rows = await sql<{ photo_path: string | null }[]>`
    select photo_path from app.reviews where book_id = ${bookId}
  `;
  return rows[0]?.photo_path ?? null;
};
