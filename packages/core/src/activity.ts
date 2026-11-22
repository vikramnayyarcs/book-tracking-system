import type { Sql } from "./api/db.ts";

export const parseYear = (value: string | undefined) => {
  if (value === undefined || !/^\d{4}$/.test(value)) {
    return undefined;
  }
  const year = Number(value);
  return year >= 1900 && year <= 2200 ? year : undefined;
};

export const getActivity = async (sql: Sql, year: number) => {
  const zone = await sql<{ time_zone: string }[]>`
    select time_zone from app.users limit 1
  `;
  const timeZone = zone[0]?.time_zone ?? "UTC";
  const first = `${year}-01-01`;
  const last = `${year}-12-31`;
  const rows = await sql<{ day: string }[]>`
    select distinct day::text as day from (
      select s.date as day from app.sessions s
      union all
      select (r.created_at at time zone ${timeZone})::date from app.reviews r
    ) d
    where day between ${first}::date and ${last}::date
    order by day
  `;
  return { year, timeZone, dates: rows.map((r) => r.day) };
};
