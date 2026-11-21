import type { Sql } from "./api/db.ts";

export const BOOK_STATUSES = ["reading", "finished", "abandoned"] as const;
export const PRECISIONS = ["day", "month", "year"] as const;

export type BookStatus = (typeof BOOK_STATUSES)[number];
export type Precision = (typeof PRECISIONS)[number];

export type Book = {
  id: string;
  isbn: string | null;
  title: string;
  author: string | null;
  coverUrl: string | null;
  pageCount: number | null;
  status: BookStatus;
  startedOn: string | null;
  finishedOn: string | null;
  finishedPrecision: Precision | null;
  addedRetrospectively: boolean;
  createdAt: string;
};

type BookRow = {
  id: string;
  isbn: string | null;
  title: string;
  author: string | null;
  cover_url: string | null;
  page_count: number | null;
  status: BookStatus;
  started_on: string | null;
  finished_on: string | null;
  finished_precision: Precision | null;
  added_retrospectively: boolean;
  created_at: Date;
};

export type BookFields = {
  isbn?: string | null;
  title?: string;
  author?: string | null;
  coverUrl?: string | null;
  pageCount?: number | null;
  status?: BookStatus;
  startedOn?: string | null;
  finishedOn?: string | null;
  finishedPrecision?: Precision | null;
  addedRetrospectively?: boolean;
};

const columns = `id, isbn, title, author, cover_url, page_count, status,
  to_char(started_on, 'YYYY-MM-DD') as started_on,
  to_char(finished_on, 'YYYY-MM-DD') as finished_on,
  finished_precision, added_retrospectively, created_at`;

const toBook = (row: BookRow) =>
  ({
    id: row.id,
    isbn: row.isbn,
    title: row.title,
    author: row.author,
    coverUrl: row.cover_url,
    pageCount: row.page_count,
    status: row.status,
    startedOn: row.started_on,
    finishedOn: row.finished_on,
    finishedPrecision: row.finished_precision,
    addedRetrospectively: row.added_retrospectively,
    createdAt: row.created_at.toISOString(),
  }) satisfies Book;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isDate = (value: unknown) =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
  new Date(`${value}T00:00:00Z`).toISOString().startsWith(value);

const KEYS = [
  "isbn",
  "title",
  "author",
  "coverUrl",
  "pageCount",
  "status",
  "startedOn",
  "finishedOn",
  "finishedPrecision",
  "addedRetrospectively",
] as const;

const fail = (detail: string) => ({ ok: false, detail }) as const;

export const parseBookFields = (input: unknown, mode: "create" | "update") => {
  if (!isRecord(input)) {
    return fail("Body must be a JSON object");
  }
  for (const key of Object.keys(input)) {
    if (!(KEYS as readonly string[]).includes(key)) {
      return fail(`Unknown field ${key}`);
    }
  }
  const nullable = mode === "update";
  const text = (key: string, max: number) => {
    const value = input[key];
    if (value === undefined) {
      return undefined;
    }
    if (value === null && nullable) {
      return null;
    }
    return typeof value === "string" && value.length <= max ? value : false;
  };
  const fields: Record<string, unknown> = {};
  const checks: [string, unknown][] = [
    ["isbn", text("isbn", 20)],
    ["author", text("author", 300)],
    ["coverUrl", text("coverUrl", 2000)],
  ];
  for (const [key, value] of checks) {
    if (value === false) {
      return fail(`Invalid ${key}`);
    }
    if (value !== undefined) {
      fields[key] = value;
    }
  }
  if (input["title"] !== undefined) {
    const title = input["title"];
    if (typeof title !== "string" || title.length === 0 || title.length > 300) {
      return fail("Invalid title");
    }
    fields["title"] = title;
  } else if (mode === "create") {
    return fail("title is required");
  }
  const pages = input["pageCount"];
  if (pages !== undefined) {
    if (pages === null && nullable) {
      fields["pageCount"] = null;
    } else if (
      typeof pages === "number" &&
      Number.isInteger(pages) &&
      pages > 0
    ) {
      fields["pageCount"] = pages;
    } else {
      return fail("Invalid pageCount");
    }
  }
  const status = input["status"];
  if (status !== undefined) {
    if (!(BOOK_STATUSES as readonly unknown[]).includes(status)) {
      return fail("Invalid status");
    }
    fields["status"] = status;
  }
  for (const key of ["startedOn", "finishedOn"]) {
    const value = input[key];
    if (value === undefined) {
      continue;
    }
    if (value === null && nullable) {
      fields[key] = null;
    } else if (isDate(value)) {
      fields[key] = value;
    } else {
      return fail(`Invalid ${key}`);
    }
  }
  const precision = input["finishedPrecision"];
  if (precision !== undefined) {
    if (precision === null && nullable) {
      fields["finishedPrecision"] = null;
    } else if ((PRECISIONS as readonly unknown[]).includes(precision)) {
      fields["finishedPrecision"] = precision;
    } else {
      return fail("Invalid finishedPrecision");
    }
  }
  const retro = input["addedRetrospectively"];
  if (retro !== undefined) {
    if (typeof retro !== "boolean") {
      return fail("Invalid addedRetrospectively");
    }
    fields["addedRetrospectively"] = retro;
  }
  if (mode === "update" && Object.keys(fields).length === 0) {
    return fail("Nothing to change");
  }
  const touchesFinish = "finishedOn" in fields || "finishedPrecision" in fields;
  if (mode === "create" || touchesFinish) {
    const hasDate = fields["finishedOn"] != null;
    const hasPrecision = fields["finishedPrecision"] != null;
    if (mode === "create" && hasDate !== hasPrecision) {
      return fail("finishedOn and finishedPrecision go together");
    }
    if (
      mode === "update" &&
      "finishedOn" in fields !== "finishedPrecision" in fields
    ) {
      return fail("finishedOn and finishedPrecision change together");
    }
    if (mode === "update" && hasDate !== hasPrecision) {
      return fail("finishedOn and finishedPrecision go together");
    }
  }
  return { ok: true, fields: fields as BookFields } as const;
};

export const listBooks = async (sql: Sql, status: BookStatus | undefined) => {
  const rows = await sql<BookRow[]>`
    select ${sql.unsafe(columns)} from app.books
    where ${status === undefined ? sql`true` : sql`status = ${status}`}
    order by created_at desc, id
  `;
  return rows.map(toBook);
};

export const getBook = async (sql: Sql, id: string) => {
  const rows = await sql<BookRow[]>`
    select ${sql.unsafe(columns)} from app.books where id = ${id}
  `;
  const row = rows[0];
  return row === undefined ? undefined : toBook(row);
};

export const createBook = async (sql: Sql, fields: BookFields) => {
  const rows = await sql<BookRow[]>`
    insert into app.books (
      isbn, title, author, cover_url, page_count, status,
      started_on, finished_on, finished_precision, added_retrospectively
    ) values (
      ${fields.isbn ?? null}, ${fields.title ?? ""}, ${fields.author ?? null},
      ${fields.coverUrl ?? null}, ${fields.pageCount ?? null},
      ${fields.status ?? "reading"}, ${fields.startedOn ?? null},
      ${fields.finishedOn ?? null}, ${fields.finishedPrecision ?? null},
      ${fields.addedRetrospectively ?? false}
    )
    returning ${sql.unsafe(columns)}
  `;
  return toBook(rows[0] as BookRow);
};

const COLUMN_FOR: Record<keyof BookFields, string> = {
  isbn: "isbn",
  title: "title",
  author: "author",
  coverUrl: "cover_url",
  pageCount: "page_count",
  status: "status",
  startedOn: "started_on",
  finishedOn: "finished_on",
  finishedPrecision: "finished_precision",
  addedRetrospectively: "added_retrospectively",
};

export const updateBook = async (sql: Sql, id: string, fields: BookFields) => {
  const values: Record<string, string | number | boolean | null> = {};
  for (const key of Object.keys(fields) as (keyof BookFields)[]) {
    values[COLUMN_FOR[key]] = fields[key] ?? null;
  }
  const rows = await sql<BookRow[]>`
    update app.books set ${sql(values)} where id = ${id}
    returning ${sql.unsafe(columns)}
  `;
  const row = rows[0];
  return row === undefined ? undefined : toBook(row);
};

export const storagePathsForBook = async (sql: Sql, id: string) => {
  const audio = await sql<{ path: string }[]>`
    select audio_path as path from app.sessions
    where book_id = ${id} and audio_path is not null
  `;
  const photos = await sql<{ path: string }[]>`
    select photo_path as path from app.reviews
    where book_id = ${id} and photo_path is not null
  `;
  return {
    audio: audio.map((row) => row.path),
    photos: photos.map((row) => row.path),
  };
};

export const deleteBook = async (sql: Sql, id: string) => {
  const rows = await sql<{ id: string }[]>`
    delete from app.books where id = ${id} returning id
  `;
  return rows.length === 1;
};
