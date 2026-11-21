import type { Sql } from "./api/db.ts";

export const STAGES = ["mid", "end", "recall"] as const;
export type Stage = (typeof STAGES)[number];

export type Reflection = {
  id: string;
  bookId: string;
  stage: "mid" | "end" | "recall";
  position: number;
  question: string;
  answer: string | null;
};

type Row = {
  id: string;
  book_id: string;
  stage: Reflection["stage"];
  position: number;
  question: string;
  answer: string | null;
};

const columns = "id, book_id, stage, position, question, answer";

const toReflection = (row: Row) =>
  ({
    id: row.id,
    bookId: row.book_id,
    stage: row.stage,
    position: row.position,
    question: row.question,
    answer: row.answer,
  }) satisfies Reflection;

const fail = (detail: string) => ({ ok: false, detail }) as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const parseReflectionCreate = (input: unknown) => {
  if (!isRecord(input)) {
    return fail("Body must be a JSON object");
  }
  for (const key of Object.keys(input)) {
    if (key !== "stage") {
      return fail(`Unknown field ${key}`);
    }
  }
  const stage = STAGES.find((value) => value === input["stage"]);
  return stage === undefined
    ? fail("stage must be mid, end or recall")
    : ({ ok: true, stage } as const);
};

export const parseReflectionAnswer = (input: unknown) => {
  if (!isRecord(input)) {
    return fail("Body must be a JSON object");
  }
  for (const key of Object.keys(input)) {
    if (key !== "answer") {
      return fail(`Unknown field ${key}`);
    }
  }
  const answer = input["answer"];
  if (answer !== null && (typeof answer !== "string" || answer.length > 5000)) {
    return fail("answer must be text up to 5000 characters, or null");
  }
  return { ok: true, answer: answer as string | null } as const;
};

export const listReflections = async (sql: Sql, bookId: string) => {
  const books = await sql<{ id: string }[]>`
    select id from app.books where id = ${bookId}
  `;
  if (books.length === 0) {
    return undefined;
  }
  const rows = await sql<Row[]>`
    select ${sql.unsafe(columns)} from app.reflections
    where book_id = ${bookId} order by stage, position
  `;
  return rows.map(toReflection);
};

const NOTE_CHARS = 1500;
const TOTAL_CHARS = 12000;

export const loadReflectionSource = async (sql: Sql, bookId: string) => {
  const books = await sql<{ title: string; author: string | null }[]>`
    select title, author from app.books where id = ${bookId}
  `;
  const book = books[0];
  if (book === undefined) {
    return undefined;
  }
  const sessions = await sql<{ note_text: string }[]>`
    select note_text from app.sessions
    where book_id = ${bookId} and note_text is not null and note_text <> ''
    order by date desc, created_at desc
  `;
  const insights = await sql<{ text: string }[]>`
    select text from app.insights where book_id = ${bookId}
    order by pinned desc, created_at desc
  `;
  const notes: string[] = [];
  let total = 0;
  for (const text of [
    ...sessions.map((row) => row.note_text),
    ...insights.map((row) => row.text),
  ]) {
    const clipped = text.slice(0, NOTE_CHARS);
    if (total + clipped.length > TOTAL_CHARS) {
      break;
    }
    total += clipped.length;
    notes.push(clipped);
  }
  return { book, notes };
};

export const saveQuestions = async (
  sql: Sql,
  bookId: string,
  stage: Stage,
  questions: string[],
) => {
  const rows: Row[] = [];
  for (const [index, question] of questions.entries()) {
    const inserted = await sql<Row[]>`
      insert into app.reflections (book_id, stage, position, question)
      values (${bookId}, ${stage}, ${index + 1}, ${question})
      returning ${sql.unsafe(columns)}
    `;
    rows.push(inserted[0] as Row);
  }
  return rows.map(toReflection);
};

export const answerReflection = async (
  sql: Sql,
  id: string,
  answer: string | null,
) => {
  const rows = await sql<Row[]>`
    update app.reflections set answer = ${answer} where id = ${id}
    returning ${sql.unsafe(columns)}
  `;
  const row = rows[0];
  return row === undefined ? undefined : toReflection(row);
};
