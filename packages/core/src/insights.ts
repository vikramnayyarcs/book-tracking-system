import type { Sql } from "./api/db.ts";

export type Insight = {
  id: string;
  bookId: string;
  sessionId: string | null;
  kind: "insight" | "quote";
  text: string;
  originalText: string | null;
  source: "ai" | "user";
  page: number | null;
  pinned: boolean;
  createdAt: string;
};

type InsightRow = {
  id: string;
  book_id: string;
  session_id: string | null;
  kind: "insight" | "quote";
  text: string;
  original_text: string | null;
  source: "ai" | "user";
  page: number | null;
  pinned: boolean;
  created_at: Date;
};

export type InsightCreate = {
  text: string;
  kind?: "insight" | "quote";
  page?: number;
  sessionId?: string;
  pinned?: boolean;
};

export type InsightUpdate = {
  text?: string;
  page?: number | null;
  pinned?: boolean;
};

const columns = `id, book_id, session_id, kind, text, original_text, source,
  page, pinned, created_at`;

const toInsight = (row: InsightRow) =>
  ({
    id: row.id,
    bookId: row.book_id,
    sessionId: row.session_id,
    kind: row.kind,
    text: row.text,
    originalText: row.original_text,
    source: row.source,
    page: row.page,
    pinned: row.pinned,
    createdAt: row.created_at.toISOString(),
  }) satisfies Insight;

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const fail = (detail: string) => ({ ok: false, detail }) as const;

const validText = (value: unknown) =>
  typeof value === "string" && value.trim().length > 0 && value.length <= 5000;

const validPage = (value: unknown) =>
  typeof value === "number" && Number.isInteger(value) && value > 0;

export const parseInsightCreate = (input: unknown) => {
  if (!isRecord(input)) {
    return fail("Body must be a JSON object");
  }
  for (const key of Object.keys(input)) {
    if (!["text", "kind", "page", "sessionId", "pinned"].includes(key)) {
      return fail(`Unknown field ${key}`);
    }
  }
  if (!validText(input["text"])) {
    return fail("text must be 1 to 5000 characters");
  }
  const insight: InsightCreate = { text: input["text"] as string };
  if (input["kind"] !== undefined) {
    if (input["kind"] !== "insight" && input["kind"] !== "quote") {
      return fail("Invalid kind");
    }
    insight.kind = input["kind"];
  }
  if (input["page"] !== undefined) {
    if (!validPage(input["page"])) {
      return fail("Invalid page");
    }
    insight.page = input["page"] as number;
  }
  if (input["sessionId"] !== undefined) {
    if (
      typeof input["sessionId"] !== "string" ||
      !uuid.test(input["sessionId"])
    ) {
      return fail("sessionId must be a UUID");
    }
    insight.sessionId = input["sessionId"];
  }
  if (input["pinned"] !== undefined) {
    if (typeof input["pinned"] !== "boolean") {
      return fail("Invalid pinned");
    }
    insight.pinned = input["pinned"];
  }
  return { ok: true, insight } as const;
};

export const parseInsightUpdate = (input: unknown) => {
  if (!isRecord(input)) {
    return fail("Body must be a JSON object");
  }
  for (const key of Object.keys(input)) {
    if (!["text", "page", "pinned"].includes(key)) {
      return fail(`Unknown field ${key}`);
    }
  }
  const fields: InsightUpdate = {};
  if (input["text"] !== undefined) {
    if (!validText(input["text"])) {
      return fail("text must be 1 to 5000 characters");
    }
    fields.text = input["text"] as string;
  }
  if (input["page"] !== undefined) {
    if (input["page"] !== null && !validPage(input["page"])) {
      return fail("Invalid page");
    }
    fields.page = input["page"] as number | null;
  }
  if (input["pinned"] !== undefined) {
    if (typeof input["pinned"] !== "boolean") {
      return fail("Invalid pinned");
    }
    fields.pinned = input["pinned"];
  }
  if (Object.keys(fields).length === 0) {
    return fail("Nothing to change");
  }
  return { ok: true, fields } as const;
};

export const listAllInsights = async (sql: Sql) => {
  const rows = await sql<InsightRow[]>`
    select ${sql.unsafe(columns)} from app.insights
    order by created_at, id
  `;
  return rows.map(toInsight);
};

export const listBookInsights = async (sql: Sql, bookId: string) => {
  const exists = await sql<{ id: string }[]>`
    select id from app.books where id = ${bookId}
  `;
  if (exists.length === 0) {
    return undefined;
  }
  const rows = await sql<InsightRow[]>`
    select ${sql.unsafe(columns)} from app.insights
    where book_id = ${bookId}
    order by pinned desc, created_at desc, id
  `;
  return rows.map(toInsight);
};

export const listSessionInsights = async (sql: Sql, sessionId: string) => {
  const exists = await sql<{ id: string }[]>`
    select id from app.sessions where id = ${sessionId}
  `;
  if (exists.length === 0) {
    return undefined;
  }
  const rows = await sql<InsightRow[]>`
    select ${sql.unsafe(columns)} from app.insights
    where session_id = ${sessionId}
    order by pinned desc, created_at desc, id
  `;
  return rows.map(toInsight);
};

export const createInsight = async (
  sql: Sql,
  bookId: string,
  input: InsightCreate,
) => {
  const books = await sql<{ id: string }[]>`
    select id from app.books where id = ${bookId}
  `;
  if (books.length === 0) {
    return undefined;
  }
  if (input.sessionId !== undefined) {
    const sessions = await sql<{ id: string }[]>`
      select id from app.sessions
      where id = ${input.sessionId} and book_id = ${bookId}
    `;
    if (sessions.length === 0) {
      return undefined;
    }
  }
  const rows = await sql<InsightRow[]>`
    insert into app.insights (book_id, session_id, kind, text, source, page, pinned)
    values (
      ${bookId}, ${input.sessionId ?? null}, ${input.kind ?? "insight"},
      ${input.text}, 'user', ${input.page ?? null}, ${input.pinned ?? false}
    )
    returning ${sql.unsafe(columns)}
  `;
  return toInsight(rows[0] as InsightRow);
};

export const updateInsight = async (
  sql: Sql,
  id: string,
  fields: InsightUpdate,
) => {
  const values: Record<string, string | number | boolean | null> = {};
  for (const key of Object.keys(fields) as (keyof InsightUpdate)[]) {
    values[key] = fields[key] ?? null;
  }
  const rows = await sql<InsightRow[]>`
    update app.insights set ${sql(values)} where id = ${id}
    returning ${sql.unsafe(columns)}
  `;
  const row = rows[0];
  return row === undefined ? undefined : toInsight(row);
};

export const deleteInsight = async (sql: Sql, id: string) => {
  const rows = await sql<{ id: string }[]>`
    delete from app.insights where id = ${id} returning id
  `;
  return rows.length === 1;
};
