import type { Sql } from "./api/db.ts";

export type NudgeSettings = {
  timeZone: string;
  nudgeTime: string | null;
  notReadingUntil: string | null;
};

export type MeUpdate = {
  timeZone?: string;
  nudgeTime?: string | null;
  notReadingToday?: boolean;
};

export type PushSubscriptionInput = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type PushSubscription = {
  id: string;
  endpoint: string;
  createdAt: string;
};

type Failure = { ok: false; detail: string };

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasOnly = (record: Record<string, unknown>, keys: readonly string[]) =>
  Object.keys(record).every((key) => keys.includes(key));

export const isTimeZone = (value: string) => {
  if (value.length < 1 || value.length > 64) {
    return false;
  }
  try {
    return Boolean(new Intl.DateTimeFormat("en-US", { timeZone: value }));
  } catch {
    return false;
  }
};

const goodKey = (value: unknown): value is string =>
  typeof value === "string" && value.length >= 1 && value.length <= 256;

const nudgeTimePattern = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

export const localDate = (at: number, timeZone: string) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(at));
  const part = (type: string) =>
    parts.find((entry) => entry.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
};

export const parseMeUpdate = (body: unknown) => {
  if (!isObject(body)) {
    return { ok: false, detail: "Body must be an object" } satisfies Failure;
  }
  if (!hasOnly(body, ["timeZone", "nudgeTime", "notReadingToday"])) {
    return { ok: false, detail: "Unknown field" } satisfies Failure;
  }
  if (Object.keys(body).length === 0) {
    return { ok: false, detail: "Send at least one field" } satisfies Failure;
  }
  const update: MeUpdate = {};
  if ("timeZone" in body) {
    if (typeof body["timeZone"] !== "string" || !isTimeZone(body["timeZone"])) {
      return {
        ok: false,
        detail: "timeZone must be an IANA time zone name",
      } satisfies Failure;
    }
    update.timeZone = body["timeZone"];
  }
  if ("nudgeTime" in body) {
    const value = body["nudgeTime"];
    if (
      value !== null &&
      !(typeof value === "string" && nudgeTimePattern.test(value))
    ) {
      return {
        ok: false,
        detail: "nudgeTime must be HH:MM or null",
      } satisfies Failure;
    }
    update.nudgeTime = value;
  }
  if ("notReadingToday" in body) {
    if (typeof body["notReadingToday"] !== "boolean") {
      return {
        ok: false,
        detail: "notReadingToday must be true or false",
      } satisfies Failure;
    }
    update.notReadingToday = body["notReadingToday"];
  }
  return { ok: true, update } as const;
};

export const parsePushSubscription = (body: unknown) => {
  if (!isObject(body) || !hasOnly(body, ["endpoint", "keys"])) {
    return {
      ok: false,
      detail: "Body must have only endpoint and keys",
    } satisfies Failure;
  }
  const { endpoint, keys } = body;
  if (
    typeof endpoint !== "string" ||
    endpoint.length > 2048 ||
    !URL.canParse(endpoint) ||
    new URL(endpoint).protocol !== "https:"
  ) {
    return {
      ok: false,
      detail: "endpoint must be an https URL",
    } satisfies Failure;
  }
  if (!isObject(keys) || !hasOnly(keys, ["p256dh", "auth"])) {
    return {
      ok: false,
      detail: "keys must have only p256dh and auth",
    } satisfies Failure;
  }
  const { p256dh, auth } = keys;
  if (!goodKey(p256dh) || !goodKey(auth)) {
    return {
      ok: false,
      detail: "p256dh and auth must be 1 to 256 characters",
    } satisfies Failure;
  }
  return { ok: true, subscription: { endpoint, p256dh, auth } } as const;
};

export const parseEndpointQuery = (value: string | undefined) =>
  value !== undefined &&
  value.length <= 2048 &&
  URL.canParse(value) &&
  new URL(value).protocol === "https:"
    ? value
    : undefined;

const settingsSql = `
  time_zone as "timeZone",
  to_char(nudge_time, 'HH24:MI') as "nudgeTime",
  to_char(not_reading_until, 'YYYY-MM-DD') as "notReadingUntil"
`;

export const getNudgeSettings = async (sql: Sql) => {
  const rows = await sql<NudgeSettings[]>`
    select ${sql.unsafe(settingsSql)} from app.users where id = app.current_user_id()
  `;
  return rows[0] as NudgeSettings;
};

export const updateNudgeSettings = async (
  sql: Sql,
  update: MeUpdate,
  now: number,
) => {
  const current = await getNudgeSettings(sql);
  const timeZone = update.timeZone ?? current.timeZone;
  const nudgeTime =
    update.nudgeTime === undefined ? current.nudgeTime : update.nudgeTime;
  const notReadingUntil =
    update.notReadingToday === undefined
      ? current.notReadingUntil
      : update.notReadingToday
        ? localDate(now, timeZone)
        : null;
  const rows = await sql<NudgeSettings[]>`
    update app.users
    set time_zone = ${timeZone},
        nudge_time = ${nudgeTime}::time,
        not_reading_until = ${notReadingUntil}::date
    where id = app.current_user_id()
    returning ${sql.unsafe(settingsSql)}
  `;
  return rows[0] as NudgeSettings;
};

type SubscriptionRow = { id: string; endpoint: string; created_at: Date };

export const savePushSubscription = async (
  sql: Sql,
  input: PushSubscriptionInput,
) => {
  const rows = await sql<SubscriptionRow[]>`
    insert into app.push_subscriptions (endpoint, p256dh, auth)
    values (${input.endpoint}, ${input.p256dh}, ${input.auth})
    on conflict (user_id, endpoint)
    do update set p256dh = excluded.p256dh, auth = excluded.auth
    returning id, endpoint, created_at
  `;
  const row = rows[0] as SubscriptionRow;
  return {
    id: row.id,
    endpoint: row.endpoint,
    createdAt: row.created_at.toISOString(),
  } satisfies PushSubscription;
};

export const deletePushSubscription = async (sql: Sql, endpoint: string) => {
  const rows = await sql`
    delete from app.push_subscriptions where endpoint = ${endpoint} returning id
  `;
  return rows.length > 0;
};
