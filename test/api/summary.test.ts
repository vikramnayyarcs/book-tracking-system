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
let freeUser: TestUser;

const as = (user: TestUser) => ({ authorization: `Bearer ${user.token}` });

const clean = async () => {
  await admin`delete from app.books where title like 'Invented summary test%'`;
  await admin`delete from app.users where id = ${freeUser.userId}`;
};

beforeAll(async () => {
  alice = await sessionTokenFor("bt-test-alice");
  bob = await sessionTokenFor("bt-test-bob");
  freeUser = await sessionTokenFor("bt-test-summary-free");
  await clean();
  await call("/me", { headers: as(alice) });
  await admin`update app.users set tier = 'plus' where id = ${alice.userId}`;
  await call("/me", { headers: as(freeUser) });
  await admin`update app.users set tier = 'free' where id = ${freeUser.userId}`;
});

afterAll(async () => {
  await clean();
  await admin.end();
});

const makeBook = async (user: TestUser, withNote: boolean) => {
  const response = await call("/books", {
    method: "POST",
    headers: as(user),
    json: { title: "Invented summary test book" },
  });
  const id = ((await response.json()) as { id: string }).id;
  if (withNote) {
    await call(`/books/${id}/insights`, {
      method: "POST",
      headers: as(user),
      json: { kind: "insight", text: "An invented insight about tides." },
    });
  }
  return id;
};

const summarize = (user: TestUser | undefined, id: string) =>
  call(`/books/${id}/summary`, {
    method: "POST",
    ...(user === undefined ? {} : { headers: as(user) }),
  });

describe("POST /books/{id}/summary", () => {
  it("gives the free tier a tier_feature_unavailable problem", async () => {
    const id = await makeBook(freeUser, true);
    const response = await summarize(freeUser, id);
    expect(response.status).toBe(403);
    const problem = (await expectMatchesContract(
      response,
      "POST",
      "/books/{id}/summary",
    )) as { code: string };
    expect(problem.code).toBe("tier_feature_unavailable");
  });

  it("returns 422 for a Plus book with no notes", async () => {
    const id = await makeBook(alice, false);
    const response = await summarize(alice, id);
    expect(response.status).toBe(422);
    await expectMatchesContract(response, "POST", "/books/{id}/summary");
  });

  it("returns 502 and keeps the old summary when the AI service is unreachable", async () => {
    const id = await makeBook(alice, true);
    await admin`
      insert into app.reviews (book_id, user_id, summary)
      values (${id}, ${alice.userId}, 'An invented old summary.')
    `;
    const response = await summarize(alice, id);
    expect(response.status).toBe(502);
    const problem = (await expectMatchesContract(
      response,
      "POST",
      "/books/{id}/summary",
    )) as { code: string };
    expect(problem.code).toBe("ai_unavailable");
    const review = await call(`/books/${id}/review`, { headers: as(alice) });
    expect(((await review.json()) as { summary: string }).summary).toBe(
      "An invented old summary.",
    );
  });

  it("returns 401 without a token", async () => {
    const id = await makeBook(alice, true);
    const response = await summarize(undefined, id);
    expect(response.status).toBe(401);
    await expectMatchesContract(response, "POST", "/books/{id}/summary");
  });

  it("returns 404 for user B and for an unknown book, and changes nothing", async () => {
    const id = await makeBook(alice, true);
    const other = await summarize(bob, id);
    expect(other.status).toBe(404);
    await expectMatchesContract(other, "POST", "/books/{id}/summary");
    const unknown = await summarize(alice, crypto.randomUUID());
    expect(unknown.status).toBe(404);
    const rows = await admin`
      select 1 from app.reviews where book_id = ${id}
    `;
    expect(rows).toHaveLength(0);
  });
});

describe("finishing a book", () => {
  it("still finishes when the background summary cannot run", async () => {
    const id = await makeBook(alice, true);
    const response = await call(`/books/${id}/finish`, {
      method: "POST",
      headers: as(alice),
      json: { rating: 4 },
    });
    expect(response.status).toBe(200);
    await expectMatchesContract(response, "POST", "/books/{id}/finish");
  });
});
