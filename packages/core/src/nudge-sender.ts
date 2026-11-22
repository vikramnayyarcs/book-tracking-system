import type { Sql } from "./api/db.ts";
import type { Job } from "./jobs.ts";
import type { PushOutcome, PushTarget } from "./webpush.ts";

export const NUDGE_WINDOW_MINUTES = 15;
export const NUDGE_TITLE = "Time to log your reading";
export const LOG_SESSION_PATH = "/log";
export const NUDGE_PAYLOAD = { title: NUDGE_TITLE, url: LOG_SESSION_PATH };

export type NudgePayload = { title: string; url: string };

export type NudgeDeps = {
  system: <T>(work: (sql: Sql) => Promise<T>) => Promise<T>;
  now: () => number;
  send: (target: PushTarget, payload: NudgePayload) => Promise<PushOutcome>;
};

export type NudgeStats = { due: number; nudged: number; removed: number };

type Due = { userId: string; day: string };
type Subscription = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

export const findDueUsers = (sql: Sql, nowMs: number) => {
  const at = new Date(nowMs).toISOString();
  return sql<Due[]>`
    with local as (
      select u.id, u.nudge_time, u.not_reading_until, u.last_nudged_on,
             (${at}::timestamptz at time zone u.time_zone) as local_now
      from app.users u
      where u.nudge_time is not null
        and u.time_zone in (select name from pg_timezone_names)
    ), due as (
      select l.id, v.d as day, l.not_reading_until, l.last_nudged_on
      from local l
      cross join lateral (
        values (l.local_now::date), (l.local_now::date - 1)
      ) as v(d)
      where (v.d + l.nudge_time) > l.local_now - make_interval(mins => ${NUDGE_WINDOW_MINUTES})
        and (v.d + l.nudge_time) <= l.local_now
    )
    select d.id as "userId", to_char(d.day, 'YYYY-MM-DD') as day
    from due d
    where (d.last_nudged_on is null or d.last_nudged_on < d.day)
      and (d.not_reading_until is null or d.not_reading_until < d.day)
      and exists (
        select 1 from app.books b where b.user_id = d.id and b.status = 'reading'
      )
      and not exists (
        select 1 from app.sessions s where s.user_id = d.id and s.date = d.day
      )
      and exists (
        select 1 from app.push_subscriptions p where p.user_id = d.id
      )
    order by d.id
  `;
};

const trySend = async (
  deps: NudgeDeps,
  target: PushTarget,
  payload: NudgePayload,
) => {
  try {
    return await deps.send(target, payload);
  } catch {
    return "failed" satisfies PushOutcome;
  }
};

export const runNudge = async (deps: NudgeDeps) => {
  const due = await deps.system((sql) => findDueUsers(sql, deps.now()));
  const stats: NudgeStats = { due: due.length, nudged: 0, removed: 0 };
  for (const user of due) {
    const subscriptions = await deps.system(
      (sql) => sql<Subscription[]>`
        select id, endpoint, p256dh, auth from app.push_subscriptions
        where user_id = ${user.userId}
      `,
    );
    const outcomes = await Promise.all(
      subscriptions.map((subscription) =>
        trySend(deps, subscription, NUDGE_PAYLOAD),
      ),
    );
    const gone = subscriptions
      .filter((_, index) => outcomes[index] === "gone")
      .map((subscription) => subscription.id);
    const delivered = outcomes.includes("sent");
    await deps.system(async (sql) => {
      if (gone.length > 0) {
        await sql`delete from app.push_subscriptions where id in ${sql(gone)}`;
      }
      if (delivered) {
        await sql`
          update app.users set last_nudged_on = ${user.day}::date
          where id = ${user.userId}
            and (last_nudged_on is null or last_nudged_on < ${user.day}::date)
        `;
      }
    });
    stats.removed += gone.length;
    stats.nudged += delivered ? 1 : 0;
  }
  return stats;
};

export const nudgeJob = (deps: NudgeDeps) =>
  ({
    bucketMinutes: NUDGE_WINDOW_MINUTES,
    run: async () => {
      await runNudge(deps);
    },
  }) satisfies Job;
