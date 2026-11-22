import { createECDH, generateKeyPairSync } from "node:crypto";
import { http, HttpResponse, passthrough } from "msw";
import { setupServer } from "msw/node";
import postgres from "postgres";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { createDb } from "../../packages/core/src/api/index.ts";
import { runNudge } from "../../packages/core/src/nudge-sender.ts";
import { sendWebPush } from "../../packages/core/src/webpush.ts";
import { baseUrl } from "./harness.ts";

const databaseUrl = process.env["DATABASE_URL"] ?? "";
const admin = postgres(databaseUrl, { prepare: false, max: 1 });
const db = createDb(databaseUrl);
const jobsSecret = process.env["JOBS_SECRET"] ?? "";

const pair = generateKeyPairSync("ec", {
  namedCurve: "prime256v1",
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "sec1", format: "pem" },
});
const vapid = {
  subject: "https://example.invalid",
  publicKey: pair.publicKey,
  privateKey: pair.privateKey,
};

const PREFIX = "bt-test-nudge-";
const now = Date.parse("2026-11-22T10:07:00Z");

const hits: string[] = [];
const statuses = new Map<string, number>();
const server = setupServer(
  http.all(`${baseUrl}/*`, () => passthrough()),
  http.post("https://push.example.test/:user/:index", ({ params }) => {
    const key = `${String(params["user"])}/${String(params["index"])}`;
    hits.push(key);
    return new HttpResponse(null, { status: statuses.get(key) ?? 201 });
  }),
);

type Seed = {
  tz?: string;
  nudgeTime?: string | null;
  notReadingUntil?: string;
  lastNudgedOn?: string;
  reading?: boolean;
  sessionOn?: string;
  subscriptions?: number;
};

const subscriptionKeys = () => {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  return {
    p256dh: ecdh.getPublicKey().toString("base64url"),
    auth: Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString(
      "base64url",
    ),
  };
};

const seed = async (name: string, options: Seed = {}) => {
  const id = `${PREFIX}${name}`;
  await admin`
    insert into app.users (id, time_zone, nudge_time, not_reading_until, last_nudged_on)
    values (
      ${id},
      ${options.tz ?? "UTC"},
      ${options.nudgeTime === undefined ? "10:00" : options.nudgeTime}::time,
      ${options.notReadingUntil ?? null}::date,
      ${options.lastNudgedOn ?? null}::date
    )
  `;
  const bookId = crypto.randomUUID();
  await admin`
    insert into app.books (id, user_id, title, status, finished_on, finished_precision)
    values (
      ${bookId}, ${id}, 'Invented nudge test book',
      ${options.reading === false ? "finished" : "reading"},
      ${options.reading === false ? "2026-01-01" : null}::date,
      ${options.reading === false ? "day" : null}
    )
  `;
  if (options.sessionOn !== undefined) {
    await admin`
      insert into app.sessions (user_id, book_id, date)
      values (${id}, ${bookId}, ${options.sessionOn}::date)
    `;
  }
  for (let index = 0; index < (options.subscriptions ?? 1); index++) {
    const keys = subscriptionKeys();
    await admin`
      insert into app.push_subscriptions (user_id, endpoint, p256dh, auth)
      values (
        ${id}, ${`https://push.example.test/${name}/${index}`},
        ${keys.p256dh}, ${keys.auth}
      )
    `;
  }
  return id;
};

const run = (at: number) =>
  runNudge({
    system: db.system,
    now: () => at,
    send: (target, payload) =>
      sendWebPush({ fetch, now: () => at, vapid }, target, payload),
  });

const lastNudged = async (name: string) => {
  const rows = await admin`
    select to_char(last_nudged_on, 'YYYY-MM-DD') as day
    from app.users where id = ${PREFIX + name}
  `;
  return rows[0]?.["day"] ?? null;
};

const subscriptionCount = async (name: string) => {
  const rows = await admin`
    select count(*)::int as n from app.push_subscriptions
    where user_id = ${PREFIX + name}
  `;
  return rows[0]?.["n"];
};

const clean = async () => {
  await admin`delete from app.users where id like ${`${PREFIX}%`}`;
  await admin`delete from app.job_runs where run_key like 'bt-test-nudge-%'`;
};

beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
beforeEach(async () => {
  hits.length = 0;
  statuses.clear();
  await clean();
});
afterEach(() => server.resetHandlers());
afterAll(async () => {
  server.close();
  await clean();
  await admin.end();
});

const sentTo = () =>
  [...new Set(hits.map((hit) => hit.split("/")[0]))].toSorted();

describe("nudge job", () => {
  it("sends only to users who pass every rule", async () => {
    const sent = [
      "in-window",
      "window-end",
      "window-start-edge",
      "new-york",
      "session-yesterday",
      "not-reading-ended",
      "nudged-yesterday",
    ];
    await seed("in-window");
    await seed("window-end", { nudgeTime: "10:07" });
    await seed("window-start-edge", { nudgeTime: "09:53" });
    await seed("new-york", { tz: "America/New_York", nudgeTime: "05:00" });
    await seed("session-yesterday", { sessionOn: "2026-11-21" });
    await seed("not-reading-ended", { notReadingUntil: "2026-11-21" });
    await seed("nudged-yesterday", { lastNudgedOn: "2026-11-21" });

    await seed("before-window", { nudgeTime: "09:52" });
    await seed("after-now", { nudgeTime: "10:08" });
    await seed("tokyo", { tz: "Asia/Tokyo" });
    await seed("nudges-off", { nudgeTime: null });
    await seed("session-today", { sessionOn: "2026-11-22" });
    await seed("not-reading-book", { reading: false });
    await seed("not-reading-today", { notReadingUntil: "2026-11-22" });
    await seed("not-reading-future", { notReadingUntil: "2026-11-25" });
    await seed("nudged-today", { lastNudgedOn: "2026-11-22" });
    await seed("no-subscription", { subscriptions: 0 });

    await run(now);

    expect(sentTo()).toEqual([...sent].toSorted());
    for (const name of sent) {
      expect(await lastNudged(name)).toBe("2026-11-22");
    }
    expect(await lastNudged("nudged-today")).toBe("2026-11-22");
    expect(await lastNudged("before-window")).toBeNull();
    expect(await lastNudged("tokyo")).toBeNull();
    expect(await lastNudged("no-subscription")).toBeNull();
  });

  it("sends one push per subscription", async () => {
    await seed("two-devices", { subscriptions: 2 });
    await run(now);
    expect(hits.toSorted()).toEqual(["two-devices/0", "two-devices/1"]);
  });

  it("nudges a user once a day, even when the job runs again in the same window", async () => {
    await seed("once");
    await run(now);
    await run(now + 60_000);
    await run(now + 5 * 60_000);
    expect(hits).toEqual(["once/0"]);
    await run(now + 24 * 60 * 60_000);
    expect(hits).toEqual(["once/0", "once/0"]);
    expect(await lastNudged("once")).toBe("2026-11-23");
  });

  it("nudges again the next day, and a window that crosses midnight counts for the day it began", async () => {
    await seed("late", { nudgeTime: "23:55" });
    await run(Date.parse("2026-11-23T00:05:00Z"));
    expect(hits).toEqual(["late/0"]);
    expect(await lastNudged("late")).toBe("2026-11-22");
  });

  it("deletes subscriptions the push service answers with 404 or 410, and keeps the rest", async () => {
    await seed("mixed", { subscriptions: 4 });
    statuses.set("mixed/1", 404);
    statuses.set("mixed/2", 410);
    statuses.set("mixed/3", 500);
    await run(now);
    expect(hits.toSorted()).toEqual([
      "mixed/0",
      "mixed/1",
      "mixed/2",
      "mixed/3",
    ]);
    expect(await subscriptionCount("mixed")).toBe(2);
    expect(await lastNudged("mixed")).toBe("2026-11-22");
  });

  it("does not mark the user nudged when no push was delivered, so a later run can try again", async () => {
    await seed("down");
    statuses.set("down/0", 500);
    await run(now);
    expect(await lastNudged("down")).toBeNull();
    expect(await subscriptionCount("down")).toBe(1);
    statuses.clear();
    await run(now + 60_000);
    expect(await lastNudged("down")).toBe("2026-11-22");
  });
});

describe("POST /internal/jobs/nudge", () => {
  it("is a registered job and does its work once per run key", async () => {
    const runKey = `bt-test-nudge-${crypto.randomUUID()}`;
    const call = () =>
      fetch(`${baseUrl}/internal/jobs/nudge?run_key=${runKey}`, {
        method: "POST",
        headers: { "x-jobs-secret": jobsSecret },
      });
    const first = await call();
    const second = await call();
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ job: "nudge", runKey, ran: true });
    expect(await second.json()).toEqual({ job: "nudge", runKey, ran: false });
  });
});
