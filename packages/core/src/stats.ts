import type { Sql } from "./api/db.ts";

const WEEKS = 12;
const MONTHS = 12;

export const getStats = async (sql: Sql, now: Date) => {
  const zone = await sql<{ time_zone: string }[]>`
    select time_zone from app.users limit 1
  `;
  const timeZone = zone[0]?.time_zone ?? "UTC";
  const instant = now.toISOString();

  const weeks = await sql<{ week_start: string; count: number }[]>`
    with today as (
      select (${instant}::timestamptz at time zone ${timeZone})::date as d
    ), bounds as (
      select (date_trunc('week', d) - make_interval(weeks => ${WEEKS - 1}))::date as first,
             date_trunc('week', d)::date as last
      from today
    )
    select w::date::text as week_start, count(s.id)::int as count
    from bounds
    cross join generate_series(first, last, interval '1 week') w
    left join app.sessions s
      on date_trunc('week', s.date)::date = w::date
    group by w
    order by w
  `;

  const finished = await sql<{ month: string; count: number }[]>`
    with today as (
      select (${instant}::timestamptz at time zone ${timeZone})::date as d
    ), bounds as (
      select (date_trunc('month', d) - make_interval(months => ${MONTHS - 1}))::date as first,
             date_trunc('month', d)::date as last
      from today
    )
    select to_char(m, 'YYYY-MM') as month, count(b.id)::int as count
    from bounds
    cross join generate_series(first, last, interval '1 month') m
    left join app.books b
      on b.status = 'finished'
      and b.finished_precision in ('day', 'month')
      and date_trunc('month', b.finished_on)::date = m::date
    group by m
    order by m
  `;

  const voice = await sql<{ month: string; seconds: number }[]>`
    with today as (
      select (${instant}::timestamptz at time zone ${timeZone})::date as d
    ), bounds as (
      select (date_trunc('month', d) - make_interval(months => ${MONTHS - 1}))::date as first,
             date_trunc('month', d)::date as last
      from today
    )
    select to_char(m, 'YYYY-MM') as month,
           coalesce(sum(s.audio_seconds), 0)::int as seconds
    from bounds
    cross join generate_series(first, last, interval '1 month') m
    left join app.sessions s
      on s.note_source = 'voice'
      and date_trunc('month', s.date)::date = m::date
    group by m
    order by m
  `;

  const perBook = await sql<
    { book_id: string; title: string; insights: number; quotes: number }[]
  >`
    select b.id as book_id, b.title,
           count(i.id) filter (where i.kind = 'insight')::int as insights,
           count(i.id) filter (where i.kind = 'quote')::int as quotes
    from app.books b
    left join app.insights i on i.book_id = b.id
    group by b.id, b.title, b.created_at
    order by count(i.id) desc, b.created_at, b.id
  `;

  const ratings = await sql<{ rating: number; count: number }[]>`
    select g as rating, count(r.book_id)::int as count
    from generate_series(1, 5) g
    left join app.reviews r on r.rating = g
    group by g
    order by g
  `;

  const status = await sql<{ status: string; count: number }[]>`
    select status, count(*)::int as count from app.books group by status
  `;
  const countOf = (name: string) =>
    status.find((row) => row.status === name)?.count ?? 0;

  return {
    timeZone,
    entriesPerWeek: weeks.map((r) => ({
      weekStart: r.week_start,
      count: r.count,
    })),
    booksFinishedPerMonth: finished.map((r) => ({
      month: r.month,
      count: r.count,
    })),
    voiceMinutesPerMonth: voice.map((r) => ({
      month: r.month,
      minutes: Math.round((r.seconds / 60) * 10) / 10,
    })),
    perBook: perBook.map((r) => ({
      bookId: r.book_id,
      title: r.title,
      insights: r.insights,
      quotes: r.quotes,
    })),
    ratings,
    booksByStatus: {
      reading: countOf("reading"),
      finished: countOf("finished"),
      abandoned: countOf("abandoned"),
    },
  };
};
