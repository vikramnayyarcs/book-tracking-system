import type { Sql } from "./api/db.ts";
import type { AskNote } from "../prompts/ask-vault.v1.ts";
import { answerFromNotes, NOT_IN_NOTES } from "./ai/ask.ts";
import type { TextModel, TextUsage } from "./ai/types.ts";

export const QUESTION_MAX = 500;
export const NOTES_PER_QUESTION = 8;
export const CANDIDATES_PER_RANKER = 20;
export const VECTOR_MIN_SIMILARITY = 0.8;

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type Citation = {
  insightId: string;
  bookId: string;
  bookTitle: string;
  sessionId: string | null;
  sessionDate: string | null;
};

export type RetrievedNote = Citation & { text: string };

export const parseAsk = (body: unknown) => {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, detail: "Body must be a JSON object" } as const;
  }
  const { question, bookId, ...rest } = body as Record<string, unknown>;
  if (Object.keys(rest).length > 0) {
    return { ok: false, detail: "Unknown field" } as const;
  }
  if (typeof question !== "string") {
    return { ok: false, detail: "question must be a string" } as const;
  }
  const trimmed = question.trim();
  if (trimmed.length === 0 || trimmed.length > QUESTION_MAX) {
    return {
      ok: false,
      detail: `question must be 1 to ${QUESTION_MAX} characters`,
    } as const;
  }
  if (
    bookId !== undefined &&
    (typeof bookId !== "string" || !uuid.test(bookId))
  ) {
    return { ok: false, detail: "bookId must be a UUID" } as const;
  }
  return {
    ok: true,
    question: trimmed,
    bookId: bookId as string | undefined,
  } as const;
};

export const orQuery = (question: string) => {
  const words = question.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? [];
  return [...new Set(words)].slice(0, 24).join(" | ");
};

export const toVectorLiteral = (embedding: number[]) =>
  `[${embedding.join(",")}]`;

type NoteRow = {
  id: string;
  book_id: string;
  book_title: string;
  session_id: string | null;
  session_date: string | null;
  text: string;
};

export const bookExists = async (sql: Sql, bookId: string) =>
  (await sql`select 1 from app.books where id = ${bookId}`).length > 0;

export const loadVaultQuestionsUsed = async (sql: Sql) => {
  const rows = await sql<{ used: number }[]>`
    select coalesce(
      (select vault_questions from app.usage
        where month = date_trunc('month', now() at time zone 'UTC')::date), 0
    )::int as used
  `;
  return rows[0]?.used ?? 0;
};

export const retrieveNotes = async (
  sql: Sql,
  input: { question: string; bookId?: string; embedding: number[] | null },
) => {
  const tsq = orQuery(input.question);
  const vector =
    input.embedding === null ? null : toVectorLiteral(input.embedding);
  const book = input.bookId ?? null;
  const rows = await sql<NoteRow[]>`
    with q as (select to_tsquery('english', ${tsq}) as tsq),
    fts as (
      select i.id, row_number() over (order by ts_rank(i.text_search, q.tsq) desc, i.id) as rn
      from app.insights i, q
      where ${tsq} <> '' and i.text_search @@ q.tsq
        and (${book}::uuid is null or i.book_id = ${book}::uuid)
      order by ts_rank(i.text_search, q.tsq) desc, i.id
      limit ${CANDIDATES_PER_RANKER}
    ),
    vec as (
      select i.id, row_number() over (
        order by i.embedding operator(extensions.<=>) ${vector}::extensions.vector, i.id
      ) as rn
      from app.insights i
      where ${vector}::text is not null and i.embedding is not null
        and (${book}::uuid is null or i.book_id = ${book}::uuid)
        and 1 - (i.embedding operator(extensions.<=>) ${vector}::extensions.vector)
          >= ${VECTOR_MIN_SIMILARITY}
      order by i.embedding operator(extensions.<=>) ${vector}::extensions.vector, i.id
      limit ${CANDIDATES_PER_RANKER}
    ),
    fused as (
      select id, sum(1.0 / (60 + rn)) as score
      from (select id, rn from fts union all select id, rn from vec) ranked
      group by id
    )
    select i.id, i.book_id, b.title as book_title, i.session_id,
      s.date::text as session_date, i.text
    from fused f
    join app.insights i on i.id = f.id
    join app.books b on b.id = i.book_id
    left join app.sessions s on s.id = i.session_id
    order by f.score desc, i.id
    limit ${NOTES_PER_QUESTION}
  `;
  return rows.map(
    (row) =>
      ({
        insightId: row.id,
        bookId: row.book_id,
        bookTitle: row.book_title,
        sessionId: row.session_id,
        sessionDate: row.session_date,
        text: row.text,
      }) satisfies RetrievedNote,
  );
};

export type VaultAnswer = {
  answered: boolean;
  answer: string;
  citations: Citation[];
};

export const answerQuestion = async (
  model: TextModel,
  question: string,
  retrieved: RetrievedNote[],
) => {
  const none = {
    result: {
      answered: false,
      answer: NOT_IN_NOTES,
      citations: [],
    } satisfies VaultAnswer,
    usage: { inputTokens: 0, outputTokens: 0 } satisfies TextUsage,
  };
  if (retrieved.length === 0) return none;
  const notes: AskNote[] = retrieved.map((note, index) => ({
    n: index + 1,
    bookTitle: note.bookTitle,
    sessionDate: note.sessionDate,
    text: note.text,
  }));
  const { parsed, usage } = await answerFromNotes(model, question, notes);
  if (!parsed.found) return { ...none, usage };
  return {
    result: {
      answered: true,
      answer: parsed.answer,
      citations: parsed.cited.map((n) => {
        const note = retrieved[n - 1] as RetrievedNote;
        return {
          insightId: note.insightId,
          bookId: note.bookId,
          bookTitle: note.bookTitle,
          sessionId: note.sessionId,
          sessionDate: note.sessionDate,
        };
      }),
    } satisfies VaultAnswer,
    usage,
  };
};
