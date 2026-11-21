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
  admin`delete from app.books where title like 'Invented search test%'`;

beforeAll(async () => {
  alice = await sessionTokenFor("bt-test-alice");
  bob = await sessionTokenFor("bt-test-bob");
  await clean();
});

afterAll(async () => {
  await clean();
  await admin.end();
});

const makeBook = async (user: TestUser) => {
  const response = await call("/books", {
    method: "POST",
    headers: as(user),
    json: { title: "Invented search test book" },
  });
  return ((await response.json()) as { id: string }).id;
};

describe("search", () => {
  it("finds notes and insights by keyword, with the book title", async () => {
    const bookId = await makeBook(alice);
    await call("/sessions", {
      method: "POST",
      headers: as(alice),
      json: {
        id: crypto.randomUUID(),
        bookId,
        date: "2026-03-01",
        noteText: "The zebrafinch chapter covers migration.",
      },
    });
    await call(`/books/${bookId}/insights`, {
      method: "POST",
      headers: as(alice),
      json: { text: "Zebrafinch songs are learned, not inherited." },
    });
    const response = await call("/search?q=zebrafinch", {
      headers: as(alice),
    });
    expect(response.status).toBe(200);
    const body = (await expectMatchesContract(response, "GET", "/search")) as {
      items: { kind: string; bookTitle: string; snippet: string }[];
    };
    expect(body.items.map((i) => i.kind).sort()).toEqual([
      "insight",
      "session",
    ]);
    expect(body.items[0]?.bookTitle).toBe("Invented search test book");
    expect(body.items[0]?.snippet).toContain("[");
  });

  it("rejects an empty query and a missing token", async () => {
    const empty = await call("/search?q=", { headers: as(alice) });
    expect(empty.status).toBe(400);
    await expectMatchesContract(empty, "GET", "/search");
    const anonymous = await call("/search?q=anything");
    expect(anonymous.status).toBe(401);
  });

  it("never returns user A's rows to user B", async () => {
    const bookId = await makeBook(alice);
    await call(`/books/${bookId}/insights`, {
      method: "POST",
      headers: as(alice),
      json: { text: "Quokkaword is a private thought." },
    });
    const own = await call("/search?q=quokkaword", { headers: as(alice) });
    expect(((await own.json()) as { items: unknown[] }).items).toHaveLength(1);
    const other = await call("/search?q=quokkaword", { headers: as(bob) });
    expect(other.status).toBe(200);
    expect(((await other.json()) as { items: unknown[] }).items).toHaveLength(
      0,
    );
  });
});
