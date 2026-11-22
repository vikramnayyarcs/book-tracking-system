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
  admin`delete from app.books where title like 'Invented activity test%'`;

beforeAll(async () => {
  alice = await sessionTokenFor("bt-test-alice");
  bob = await sessionTokenFor("bt-test-bob");
  await clean();
});

afterAll(async () => {
  await clean();
  await admin`update app.users set time_zone = 'UTC' where id = ${alice.userId}`;
  await admin.end();
});

const makeBook = async (user: TestUser) => {
  const response = await call("/books", {
    method: "POST",
    headers: as(user),
    json: { title: "Invented activity test book" },
  });
  return ((await response.json()) as { id: string }).id;
};

type Activity = { year: number; timeZone: string; dates: string[] };

describe("activity", () => {
  it("lists session and review days of the year in the user's time zone", async () => {
    await admin`update app.users set time_zone = 'America/New_York' where id = ${alice.userId}`;
    const bookId = await makeBook(alice);
    for (const date of [
      "2026-03-05",
      "2026-03-05",
      "2026-03-01",
      "2025-12-31",
    ]) {
      await call("/sessions", {
        method: "POST",
        headers: as(alice),
        json: { id: crypto.randomUUID(), bookId, date },
      });
    }
    await admin`
      insert into app.reviews (book_id, user_id, rating, created_at)
      values (${bookId}, ${alice.userId}, 4, '2026-05-02T02:00:00Z')
    `;
    const response = await call("/activity?year=2026", {
      headers: as(alice),
    });
    expect(response.status).toBe(200);
    const body = (await expectMatchesContract(
      response,
      "GET",
      "/activity",
    )) as Activity;
    expect(body).toEqual({
      year: 2026,
      timeZone: "America/New_York",
      dates: ["2026-03-01", "2026-03-05", "2026-05-01"],
    });
  });

  it("rejects a missing or bad year and a missing token", async () => {
    for (const query of ["", "?year=abc", "?year=1800"]) {
      const response = await call(`/activity${query}`, { headers: as(alice) });
      expect(response.status).toBe(400);
      await expectMatchesContract(response, "GET", "/activity");
    }
    const anonymous = await call("/activity?year=2026");
    expect(anonymous.status).toBe(401);
  });

  it("never shows user A's days to user B", async () => {
    const bookId = await makeBook(alice);
    await call("/sessions", {
      method: "POST",
      headers: as(alice),
      json: { id: crypto.randomUUID(), bookId, date: "2024-07-07" },
    });
    const own = await call("/activity?year=2024", { headers: as(alice) });
    expect(((await own.json()) as Activity).dates).toEqual(["2024-07-07"]);
    const other = await call("/activity?year=2024", { headers: as(bob) });
    expect(other.status).toBe(200);
    expect(((await other.json()) as Activity).dates).toEqual([]);
  });
});
