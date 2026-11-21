import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sessionTokenFor } from "./clerk.ts";
import { call, expectMatchesContract } from "./harness.ts";

const admin = postgres(process.env["DATABASE_URL"] ?? "", {
  prepare: false,
  max: 1,
});

type TestUser = { userId: string; token: string };
let alice: TestUser;
let bob: TestUser;

const as = (user: TestUser) => ({ authorization: `Bearer ${user.token}` });

const clean = () =>
  admin`delete from app.books where title like 'Invented stats test%'`;

beforeAll(async () => {
  alice = await sessionTokenFor("bt-test-alice");
  bob = await sessionTokenFor("bt-test-bob");
  await clean();
});

afterAll(async () => {
  await clean();
  await admin.end();
});

type Stats = {
  timeZone: string;
  entriesPerWeek: { weekStart: string; count: number }[];
  booksFinishedPerMonth: { month: string; count: number }[];
  voiceMinutesPerMonth: { month: string; minutes: number }[];
  perBook: {
    bookId: string;
    title: string;
    insights: number;
    quotes: number;
  }[];
  ratings: { rating: number; count: number }[];
  booksByStatus: { reading: number; finished: number; abandoned: number };
};

const getStats = async (user: TestUser) => {
  const response = await call("/stats", { headers: as(user) });
  expect(response.status).toBe(200);
  return (await expectMatchesContract(response, "GET", "/stats")) as Stats;
};

describe("stats", () => {
  it("returns zero-filled series, per-book counts, ratings and statuses", async () => {
    await admin`update app.users set time_zone = 'UTC' where id = ${alice.userId}`;
    const created = await call("/books", {
      method: "POST",
      headers: as(alice),
      json: { title: "Invented stats test book" },
    });
    const bookId = ((await created.json()) as { id: string }).id;
    const today = (
      await admin<{ today: string }[]>`
        select (now() at time zone 'UTC')::date::text as today
      `
    )[0]!.today;
    await admin`
      insert into app.sessions (user_id, book_id, date, note_source, audio_seconds)
      values (${alice.userId}, ${bookId}, ${today}::date, 'voice', 90),
             (${alice.userId}, ${bookId}, ${today}::date, 'typed', null)
    `;
    await admin`
      insert into app.insights (user_id, book_id, kind, text)
      values (${alice.userId}, ${bookId}, 'insight', 'Invented one'),
             (${alice.userId}, ${bookId}, 'insight', 'Invented two'),
             (${alice.userId}, ${bookId}, 'quote', 'Invented quote')
    `;
    await admin`
      update app.books
      set status = 'finished', finished_on = ${today}::date, finished_precision = 'day'
      where id = ${bookId}
    `;
    await admin`
      insert into app.reviews (book_id, user_id, rating)
      values (${bookId}, ${alice.userId}, 5)
    `;

    const stats = await getStats(alice);
    expect(stats.entriesPerWeek).toHaveLength(12);
    expect(stats.booksFinishedPerMonth).toHaveLength(12);
    expect(stats.voiceMinutesPerMonth).toHaveLength(12);
    expect(stats.ratings.map((r) => r.rating)).toEqual([1, 2, 3, 4, 5]);
    expect(stats.entriesPerWeek.at(-1)?.count).toBeGreaterThanOrEqual(2);
    expect(stats.booksFinishedPerMonth.at(-1)?.count).toBeGreaterThanOrEqual(1);
    expect(stats.voiceMinutesPerMonth.at(-1)?.minutes).toBeGreaterThanOrEqual(
      1.5,
    );
    expect(stats.ratings[4]?.count).toBeGreaterThanOrEqual(1);
    expect(stats.booksByStatus.finished).toBeGreaterThanOrEqual(1);
    expect(stats.perBook.find((b) => b.bookId === bookId)).toEqual({
      bookId,
      title: "Invented stats test book",
      insights: 2,
      quotes: 1,
    });
  });

  it("needs a token", async () => {
    const response = await call("/stats");
    expect(response.status).toBe(401);
  });

  it("never counts user A's data for user B", async () => {
    const stats = await getStats(bob);
    expect(
      stats.perBook.some((b) => b.title.startsWith("Invented stats")),
    ).toBe(false);
  });
});
