import type { Sql } from "./api/db.ts";
import { summarizeNotes } from "./ai/summary.ts";
import type { TextModel } from "./ai/types.ts";
import type { Review } from "./finish.ts";
import { loadReflectionSource } from "./reflections.ts";

export type SummaryOutcome =
  { kind: "saved"; review: Review } | { kind: "missing" } | { kind: "nothing" };

const saveSummary = async (
  sql: Sql,
  bookId: string,
  summary: string,
  usage: { inputTokens: number; outputTokens: number },
) => {
  await sql`
    select app.record_usage(
      0, 0, ${usage.inputTokens}::bigint, ${usage.outputTokens}::bigint
    )
  `;
  const rows = await sql<
    {
      rating: number | null;
      text: string | null;
      summary: string | null;
      photo_path: string | null;
    }[]
  >`
    insert into app.reviews (book_id, summary) values (${bookId}, ${summary})
    on conflict (book_id) do update set summary = excluded.summary
    returning rating, text, summary, photo_path
  `;
  const row = rows[0];
  return {
    rating: row?.rating ?? null,
    text: row?.text ?? null,
    summary: row?.summary ?? null,
    hasPhoto: row?.photo_path != null,
  } satisfies Review;
};

export const runSummary = async (input: {
  withUser: <T>(work: (sql: Sql) => Promise<T>) => Promise<T>;
  text: TextModel;
  bookId: string;
}) => {
  const source = await input.withUser((sql) =>
    loadReflectionSource(sql, input.bookId),
  );
  if (source === undefined) {
    return { kind: "missing" } as const satisfies SummaryOutcome;
  }
  if (source.notes.length === 0) {
    return { kind: "nothing" } as const satisfies SummaryOutcome;
  }
  const written = await summarizeNotes(input.text, source.book, source.notes);
  const review = await input.withUser((sql) =>
    saveSummary(sql, input.bookId, written.summary, written.usage),
  );
  return { kind: "saved", review } as const satisfies SummaryOutcome;
};
