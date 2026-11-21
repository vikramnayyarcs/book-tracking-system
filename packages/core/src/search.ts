import type { Sql } from "./api/db.ts";

export const SEARCH_DEFAULT_LIMIT = 20;
export const SEARCH_MAX_LIMIT = 50;

export type SearchResult = {
  kind: "session" | "insight" | "quote" | "review";
  id: string;
  bookId: string;
  bookTitle: string;
  snippet: string;
  rank: number;
};

type SearchRow = {
  kind: SearchResult["kind"];
  id: string;
  book_id: string;
  book_title: string;
  snippet: string;
  rank: number;
};

export const parseSearch = (
  q: string | undefined,
  limit: string | undefined,
) => {
  const query = q?.trim() ?? "";
  if (query.length === 0 || query.length > 200) {
    return { ok: false, detail: "q must be 1 to 200 characters" } as const;
  }
  let max = SEARCH_DEFAULT_LIMIT;
  if (limit !== undefined) {
    const parsed = Number(limit);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > SEARCH_MAX_LIMIT) {
      return {
        ok: false,
        detail: `limit must be 1 to ${SEARCH_MAX_LIMIT}`,
      } as const;
    }
    max = parsed;
  }
  return { ok: true, query, limit: max } as const;
};

const OPTIONS =
  "StartSel=[, StopSel=], MaxWords=30, MinWords=10, MaxFragments=1";

export const searchVault = async (sql: Sql, query: string, limit: number) => {
  const rows = await sql<SearchRow[]>`
    with q as (select websearch_to_tsquery('english', ${query}) as tsq)
    select * from (
      select 'session'::text as kind, s.id, s.book_id, b.title as book_title,
        ts_headline('english', coalesce(s.note_text, ''), q.tsq, ${OPTIONS}) as snippet,
        ts_rank(s.note_search, q.tsq) as rank
      from app.sessions s join app.books b on b.id = s.book_id, q
      where s.note_search @@ q.tsq
      union all
      select i.kind, i.id, i.book_id, b.title,
        ts_headline('english', i.text, q.tsq, ${OPTIONS}),
        ts_rank(i.text_search, q.tsq)
      from app.insights i join app.books b on b.id = i.book_id, q
      where i.text_search @@ q.tsq
      union all
      select 'review'::text, r.book_id, r.book_id, b.title,
        ts_headline('english', coalesce(r.text, ''), q.tsq, ${OPTIONS}),
        ts_rank(r.text_search, q.tsq)
      from app.reviews r join app.books b on b.id = r.book_id, q
      where r.text_search @@ q.tsq
    ) matches
    order by rank desc, id
    limit ${limit}
  `;
  return rows.map(
    (row) =>
      ({
        kind: row.kind,
        id: row.id,
        bookId: row.book_id,
        bookTitle: row.book_title,
        snippet: row.snippet,
        rank: Number(row.rank),
      }) satisfies SearchResult,
  );
};
