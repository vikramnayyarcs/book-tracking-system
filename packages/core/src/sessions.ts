import type { Sql } from "./api/db.ts";
import { PLANS, type Tier } from "./plans.ts";

export const AUDIO_EXTENSIONS = ["m4a", "mp3", "wav", "webm", "ogg"] as const;
export type AudioExtension = (typeof AUDIO_EXTENSIONS)[number];

export type Session = {
  id: string;
  bookId: string;
  date: string;
  pageFrom: number | null;
  pageTo: number | null;
  chapter: string | null;
  noteText: string | null;
  noteSource: "typed" | "voice";
  audioSeconds: number | null;
  hasAudio: boolean;
  status: string;
  errorCode: string | null;
  createdAt: string;
};

type SessionRow = {
  id: string;
  book_id: string;
  date: string;
  page_from: number | null;
  page_to: number | null;
  chapter: string | null;
  note_text: string | null;
  note_source: "typed" | "voice";
  audio_path: string | null;
  audio_seconds: number | null;
  status: string;
  error_code: string | null;
  created_at: Date;
};

export type SessionCreate = {
  id: string;
  bookId: string;
  date: string;
  pageFrom?: number;
  pageTo?: number;
  chapter?: string;
  noteText?: string;
};

export type SessionUpdate = {
  date?: string;
  pageFrom?: number | null;
  pageTo?: number | null;
  chapter?: string | null;
  noteText?: string | null;
};

const columns = `id, book_id, to_char(date, 'YYYY-MM-DD') as date, page_from,
  page_to, chapter, note_text, note_source, audio_path, audio_seconds, status,
  error_code, created_at`;

const toSession = (row: SessionRow) =>
  ({
    id: row.id,
    bookId: row.book_id,
    date: row.date,
    pageFrom: row.page_from,
    pageTo: row.page_to,
    chapter: row.chapter,
    noteText: row.note_text,
    noteSource: row.note_source,
    audioSeconds: row.audio_seconds,
    hasAudio: row.audio_path !== null,
    status: row.status,
    errorCode: row.error_code,
    createdAt: row.created_at.toISOString(),
  }) satisfies Session;

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isDate = (value: unknown) =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  new Date(`${value}T00:00:00Z`).toISOString().startsWith(value);

const fail = (detail: string) => ({ ok: false, detail }) as const;

const parseCommon = (input: Record<string, unknown>, nullable: boolean) => {
  const fields: Record<string, unknown> = {};
  if (input["date"] !== undefined) {
    if (!isDate(input["date"])) {
      return fail("Invalid date");
    }
    fields["date"] = input["date"];
  }
  for (const key of ["pageFrom", "pageTo"]) {
    const value = input[key];
    if (value === undefined) {
      continue;
    }
    if (value === null && nullable) {
      fields[key] = null;
    } else if (
      typeof value === "number" &&
      Number.isInteger(value) &&
      value > 0
    ) {
      fields[key] = value;
    } else {
      return fail(`Invalid ${key}`);
    }
  }
  for (const [key, max] of [
    ["chapter", 300],
    ["noteText", 20000],
  ] as const) {
    const value = input[key];
    if (value === undefined) {
      continue;
    }
    if (value === null && nullable) {
      fields[key] = null;
    } else if (typeof value === "string" && value.length <= max) {
      fields[key] = value;
    } else {
      return fail(`Invalid ${key}`);
    }
  }
  const from = fields["pageFrom"];
  const to = fields["pageTo"];
  if (typeof from === "number" && typeof to === "number" && to < from) {
    return fail("pageTo must not be before pageFrom");
  }
  return { ok: true, fields } as const;
};

export const parseSessionCreate = (input: unknown) => {
  if (!isRecord(input)) {
    return fail("Body must be a JSON object");
  }
  const allowed = [
    "id",
    "bookId",
    "date",
    "pageFrom",
    "pageTo",
    "chapter",
    "noteText",
  ];
  for (const key of Object.keys(input)) {
    if (!allowed.includes(key)) {
      return fail(`Unknown field ${key}`);
    }
  }
  const { id, bookId } = input;
  if (typeof id !== "string" || !uuid.test(id)) {
    return fail("id must be a UUID");
  }
  if (typeof bookId !== "string" || !uuid.test(bookId)) {
    return fail("bookId must be a UUID");
  }
  if (input["date"] === undefined) {
    return fail("date is required");
  }
  const common = parseCommon(input, false);
  if (!common.ok) {
    return common;
  }
  return {
    ok: true,
    session: { id, bookId, ...common.fields } as SessionCreate,
  } as const;
};

export const parseSessionUpdate = (input: unknown) => {
  if (!isRecord(input)) {
    return fail("Body must be a JSON object");
  }
  const allowed = ["date", "pageFrom", "pageTo", "chapter", "noteText"];
  for (const key of Object.keys(input)) {
    if (!allowed.includes(key)) {
      return fail(`Unknown field ${key}`);
    }
  }
  const common = parseCommon(input, true);
  if (!common.ok) {
    return common;
  }
  if (Object.keys(common.fields).length === 0) {
    return fail("Nothing to change");
  }
  return { ok: true, fields: common.fields as SessionUpdate } as const;
};

export const parseAudioUpload = (input: unknown) => {
  if (!isRecord(input)) {
    return fail("Body must be a JSON object");
  }
  for (const key of Object.keys(input)) {
    if (key !== "durationSeconds" && key !== "extension") {
      return fail(`Unknown field ${key}`);
    }
  }
  const seconds = input["durationSeconds"];
  if (
    typeof seconds !== "number" ||
    !Number.isInteger(seconds) ||
    seconds < 1
  ) {
    return fail("durationSeconds must be a positive integer");
  }
  const extension = input["extension"] ?? "m4a";
  if (!(AUDIO_EXTENSIONS as readonly unknown[]).includes(extension)) {
    return fail("Invalid extension");
  }
  return {
    ok: true,
    durationSeconds: seconds,
    extension: extension as AudioExtension,
  } as const;
};

export const mayUploadAudio = (tier: Tier, durationSeconds: number) =>
  durationSeconds <= PLANS[tier].longestNoteSeconds;

export const audioPath = (
  userId: string,
  sessionId: string,
  extension: AudioExtension,
) => `${userId}/${sessionId}.${extension}`;

export const getSession = async (sql: Sql, id: string) => {
  const rows = await sql<SessionRow[]>`
    select ${sql.unsafe(columns)} from app.sessions where id = ${id}
  `;
  const row = rows[0];
  return row === undefined ? undefined : toSession(row);
};

export const listBookSessions = async (sql: Sql, bookId: string) => {
  const rows = await sql<SessionRow[]>`
    select ${sql.unsafe(columns)} from app.sessions
    where book_id = ${bookId}
    order by date desc, created_at desc, id
  `;
  return rows.map(toSession);
};

export const listAllSessions = async (sql: Sql) => {
  const rows = await sql<SessionRow[]>`
    select ${sql.unsafe(columns)} from app.sessions
    order by date, created_at, id
  `;
  return rows.map(toSession);
};

export type CreateResult =
  { kind: "created" | "existing"; session: Session } | { kind: "missing" };

export const createSession = async (sql: Sql, input: SessionCreate) => {
  const books = await sql<{ id: string }[]>`
    select id from app.books where id = ${input.bookId}
  `;
  if (books.length === 0) {
    return { kind: "missing" } satisfies CreateResult;
  }
  const inserted = await sql<SessionRow[]>`
    insert into app.sessions (id, book_id, date, page_from, page_to, chapter, note_text)
    values (
      ${input.id}, ${input.bookId}, ${input.date}, ${input.pageFrom ?? null},
      ${input.pageTo ?? null}, ${input.chapter ?? null}, ${input.noteText ?? null}
    )
    on conflict (id) do nothing
    returning ${sql.unsafe(columns)}
  `;
  const row = inserted[0];
  if (row !== undefined) {
    return { kind: "created", session: toSession(row) } satisfies CreateResult;
  }
  const existing = await getSession(sql, input.id);
  return existing === undefined
    ? ({ kind: "missing" } satisfies CreateResult)
    : ({ kind: "existing", session: existing } satisfies CreateResult);
};

const COLUMN_FOR: Record<keyof SessionUpdate, string> = {
  date: "date",
  pageFrom: "page_from",
  pageTo: "page_to",
  chapter: "chapter",
  noteText: "note_text",
};

export const updateSession = async (
  sql: Sql,
  id: string,
  fields: SessionUpdate,
) => {
  const values: Record<string, string | number | null> = {};
  for (const key of Object.keys(fields) as (keyof SessionUpdate)[]) {
    values[COLUMN_FOR[key]] = fields[key] ?? null;
  }
  const rows = await sql<SessionRow[]>`
    update app.sessions set ${sql(values)} where id = ${id}
    returning ${sql.unsafe(columns)}
  `;
  const row = rows[0];
  return row === undefined ? undefined : toSession(row);
};

export const sessionAudioPath = async (sql: Sql, id: string) => {
  const rows = await sql<{ audio_path: string | null }[]>`
    select audio_path from app.sessions where id = ${id}
  `;
  return rows[0]?.audio_path ?? null;
};

export const setSessionAudio = async (
  sql: Sql,
  id: string,
  path: string,
  seconds: number,
) => {
  const rows = await sql<{ id: string }[]>`
    update app.sessions
    set audio_path = ${path}, audio_seconds = ${seconds}, note_source = 'voice'
    where id = ${id}
    returning id
  `;
  return rows.length === 1;
};

export const deleteSession = async (sql: Sql, id: string) => {
  const rows = await sql<{ id: string }[]>`
    delete from app.sessions where id = ${id} returning id
  `;
  return rows.length === 1;
};
