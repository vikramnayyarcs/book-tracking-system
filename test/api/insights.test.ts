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
  admin`delete from app.books where title like 'Invented insights test%'`;

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
    json: { title: "Invented insights test book" },
  });
  return ((await response.json()) as { id: string }).id;
};

const addInsight = async (user: TestUser, bookId: string, json: unknown) =>
  call(`/books/${bookId}/insights`, {
    method: "POST",
    headers: as(user),
    json,
  });

describe("insights", () => {
  it("adds, lists, edits, pins and deletes an insight", async () => {
    const bookId = await makeBook(alice);
    const sessionId = crypto.randomUUID();
    await call("/sessions", {
      method: "POST",
      headers: as(alice),
      json: { id: sessionId, bookId, date: "2026-03-01" },
    });

    const created = await addInsight(alice, bookId, {
      text: "An invented thought",
      sessionId,
      page: 7,
    });
    expect(created.status).toBe(201);
    const insight = (await expectMatchesContract(
      created,
      "POST",
      "/books/{id}/insights",
    )) as { id: string; source: string };
    expect(insight.source).toBe("user");

    const byBook = await call(`/books/${bookId}/insights`, {
      headers: as(alice),
    });
    const bookList = (await expectMatchesContract(
      byBook,
      "GET",
      "/books/{id}/insights",
    )) as { items: { id: string }[] };
    expect(bookList.items.map((i) => i.id)).toEqual([insight.id]);

    const bySession = await call(`/sessions/${sessionId}/insights`, {
      headers: as(alice),
    });
    const sessionList = (await expectMatchesContract(
      bySession,
      "GET",
      "/sessions/{id}/insights",
    )) as { items: { id: string }[] };
    expect(sessionList.items).toHaveLength(1);

    const edited = await call(`/insights/${insight.id}`, {
      method: "PATCH",
      headers: as(alice),
      json: { text: "A reworded thought", pinned: true },
    });
    expect(edited.status).toBe(200);
    const changed = (await expectMatchesContract(
      edited,
      "PATCH",
      "/insights/{id}",
    )) as { text: string; pinned: boolean };
    expect(changed).toMatchObject({ text: "A reworded thought", pinned: true });

    const unpinned = await call(`/insights/${insight.id}`, {
      method: "PATCH",
      headers: as(alice),
      json: { pinned: false },
    });
    expect(unpinned.status).toBe(200);

    const removed = await call(`/insights/${insight.id}`, {
      method: "DELETE",
      headers: as(alice),
    });
    expect(removed.status).toBe(204);
    const again = await call(`/insights/${insight.id}`, {
      method: "DELETE",
      headers: as(alice),
    });
    expect(again.status).toBe(404);
  });

  it("keeps the first AI wording in originalText", async () => {
    const bookId = await makeBook(alice);
    const [row] = await admin<{ id: string }[]>`
      insert into app.insights (user_id, book_id, text, source)
      values (${alice.userId}, ${bookId}, 'Invented AI wording', 'ai')
      returning id
    `;
    const edited = await call(`/insights/${row?.id}`, {
      method: "PATCH",
      headers: as(alice),
      json: { text: "My wording" },
    });
    const body = (await expectMatchesContract(
      edited,
      "PATCH",
      "/insights/{id}",
    )) as { text: string; originalText: string };
    expect(body).toMatchObject({
      text: "My wording",
      originalText: "Invented AI wording",
    });
  });

  it("rejects invalid input and a missing token", async () => {
    const bookId = await makeBook(alice);
    const bad = await addInsight(alice, bookId, { text: "" });
    expect(bad.status).toBe(400);
    await expectMatchesContract(bad, "POST", "/books/{id}/insights");
    const anonymous = await call(`/books/${bookId}/insights`);
    expect(anonymous.status).toBe(401);
  });

  it("hides user A's insights from user B", async () => {
    const bookId = await makeBook(alice);
    const created = await addInsight(alice, bookId, {
      text: "Private thought",
    });
    const { id } = (await created.json()) as { id: string };

    const list = await call(`/books/${bookId}/insights`, { headers: as(bob) });
    expect(list.status).toBe(404);
    const add = await addInsight(bob, bookId, { text: "Planted" });
    expect(add.status).toBe(404);
    const patch = await call(`/insights/${id}`, {
      method: "PATCH",
      headers: as(bob),
      json: { text: "Hijacked" },
    });
    expect(patch.status).toBe(404);
    const del = await call(`/insights/${id}`, {
      method: "DELETE",
      headers: as(bob),
    });
    expect(del.status).toBe(404);
    const still = await call(`/books/${bookId}/insights`, {
      headers: as(alice),
    });
    const body = (await still.json()) as { items: { text: string }[] };
    expect(body.items.map((i) => i.text)).toEqual(["Private thought"]);
  });
});
