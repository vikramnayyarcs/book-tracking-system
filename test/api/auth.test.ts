import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb } from "../../packages/core/src/api/db.ts";
import { sessionTokenFor } from "./clerk.ts";
import { call, expectMatchesContract } from "./harness.ts";

const databaseUrl = process.env["DATABASE_URL"] ?? "";
const expectedTier = process.env["DEFAULT_TIER"] ?? "free";
const admin = postgres(databaseUrl, { prepare: false, max: 1 });
const db = createDb(databaseUrl);

type TestUser = { userId: string; token: string };
let alice: TestUser;
let bob: TestUser;

const bearer = (user: TestUser) => ({ authorization: `Bearer ${user.token}` });

beforeAll(async () => {
  alice = await sessionTokenFor("bt-test-alice");
  bob = await sessionTokenFor("bt-test-bob");
});

afterAll(async () => {
  await admin`delete from app.books where user_id in ${admin([alice.userId, bob.userId])} and title = 'Invented auth test book'`;
  await admin.end();
});

describe("GET /v1/me", () => {
  it("returns 401 without a token", async () => {
    const response = await call("/me");
    expect(response.status).toBe(401);
    const body = (await expectMatchesContract(response, "GET", "/me")) as {
      code: string;
    };
    expect(body.code).toBe("unauthorized");
  });

  it("returns 401 for a token that is not a valid Clerk token", async () => {
    const response = await call("/me", {
      headers: { authorization: "Bearer not.a.token" },
    });
    expect(response.status).toBe(401);
  });

  it("creates the users row on the first call with the default tier, once", async () => {
    const first = await call("/me", { headers: bearer(alice) });
    expect(first.status).toBe(200);
    expect(await expectMatchesContract(first, "GET", "/me")).toEqual({
      id: alice.userId,
      tier: expectedTier,
    });
    const second = await call("/me", { headers: bearer(alice) });
    expect(second.status).toBe(200);
    const rows =
      await admin`select id from app.users where id = ${alice.userId}`;
    expect(rows).toHaveLength(1);
  });
});

describe("database access per request", () => {
  it("lets user B see none of user A's rows", async () => {
    await call("/me", { headers: bearer(bob) });
    await admin`delete from app.books where title = 'Invented auth test book'`;
    await admin`insert into app.books (user_id, title) values (${alice.userId}, 'Invented auth test book')`;

    const asAlice = await db.asUser(
      alice.userId,
      "free",
      (sql) =>
        sql`select title from app.books where title = 'Invented auth test book'`,
    );
    const asBob = await db.asUser(
      bob.userId,
      "free",
      (sql) =>
        sql`select title from app.books where title = 'Invented auth test book'`,
    );
    expect(asAlice.result).toHaveLength(1);
    expect(asBob.result).toHaveLength(0);
  });
});
