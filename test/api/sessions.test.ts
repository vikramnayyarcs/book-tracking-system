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
  admin`delete from app.books where title like 'Invented sessions test%'`;

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
    json: { title: "Invented sessions test book" },
  });
  return ((await response.json()) as { id: string }).id;
};

describe("sessions", () => {
  it("creates with a client id, returns the same session on retry, then gets, lists, changes and deletes", async () => {
    const bookId = await makeBook(alice);
    const id = crypto.randomUUID();
    const body = { id, bookId, date: "2026-03-01", pageFrom: 1, pageTo: 12 };

    const created = await call("/sessions", {
      method: "POST",
      headers: as(alice),
      json: body,
    });
    expect(created.status).toBe(201);
    await expectMatchesContract(created, "POST", "/sessions");

    const retry = await call("/sessions", {
      method: "POST",
      headers: as(alice),
      json: body,
    });
    expect(retry.status).toBe(200);
    const same = (await expectMatchesContract(retry, "POST", "/sessions")) as {
      id: string;
    };
    expect(same.id).toBe(id);

    const got = await call(`/sessions/${id}`, { headers: as(alice) });
    expect(got.status).toBe(200);
    await expectMatchesContract(got, "GET", "/sessions/{id}");

    const listed = await call(`/books/${bookId}/sessions`, {
      headers: as(alice),
    });
    const list = (await expectMatchesContract(
      listed,
      "GET",
      "/books/{id}/sessions",
    )) as { items: { id: string }[] };
    expect(list.items.map((s) => s.id)).toEqual([id]);

    const changed = await call(`/sessions/${id}`, {
      method: "PATCH",
      headers: as(alice),
      json: { chapter: "Chapter 1", pageTo: null },
    });
    expect(changed.status).toBe(200);
    const patched = (await expectMatchesContract(
      changed,
      "PATCH",
      "/sessions/{id}",
    )) as { chapter: string; pageTo: number | null };
    expect(patched).toMatchObject({ chapter: "Chapter 1", pageTo: null });

    const removed = await call(`/sessions/${id}`, {
      method: "DELETE",
      headers: as(alice),
    });
    expect(removed.status).toBe(204);
    const gone = await call(`/sessions/${id}`, { headers: as(alice) });
    expect(gone.status).toBe(404);
  });

  it("rejects invalid input and a missing token", async () => {
    const bad = await call("/sessions", {
      method: "POST",
      headers: as(alice),
      json: { id: "nope" },
    });
    expect(bad.status).toBe(400);
    await expectMatchesContract(bad, "POST", "/sessions");
    const anonymous = await call("/sessions", {
      method: "POST",
      json: {},
    });
    expect(anonymous.status).toBe(401);
  });

  it("signs an audio upload and enforces the longest note", async () => {
    const bookId = await makeBook(alice);
    const id = crypto.randomUUID();
    await call("/sessions", {
      method: "POST",
      headers: as(alice),
      json: { id, bookId, date: "2026-03-02" },
    });
    const ok = await call(`/sessions/${id}/audio-upload`, {
      method: "POST",
      headers: as(alice),
      json: { durationSeconds: 60, extension: "m4a" },
    });
    expect(ok.status).toBe(200);
    const upload = (await expectMatchesContract(
      ok,
      "POST",
      "/sessions/{id}/audio-upload",
    )) as { path: string; uploadUrl: string };
    expect(upload.path).toBe(`${alice.userId}/${id}.m4a`);
    expect(upload.uploadUrl).toContain("token=");

    const tooLong = await call(`/sessions/${id}/audio-upload`, {
      method: "POST",
      headers: as(alice),
      json: { durationSeconds: 100000 },
    });
    expect(tooLong.status).toBe(403);
    await expectMatchesContract(tooLong, "POST", "/sessions/{id}/audio-upload");
  });

  it("hides user A's sessions from user B", async () => {
    const bookId = await makeBook(alice);
    const id = crypto.randomUUID();
    await call("/sessions", {
      method: "POST",
      headers: as(alice),
      json: { id, bookId, date: "2026-03-03" },
    });
    const get = await call(`/sessions/${id}`, { headers: as(bob) });
    expect(get.status).toBe(404);
    const list = await call(`/books/${bookId}/sessions`, { headers: as(bob) });
    expect(list.status).toBe(404);
    const patch = await call(`/sessions/${id}`, {
      method: "PATCH",
      headers: as(bob),
      json: { chapter: "x" },
    });
    expect(patch.status).toBe(404);
    const upload = await call(`/sessions/${id}/audio-upload`, {
      method: "POST",
      headers: as(bob),
      json: { durationSeconds: 5 },
    });
    expect(upload.status).toBe(404);
    const del = await call(`/sessions/${id}`, {
      method: "DELETE",
      headers: as(bob),
    });
    expect(del.status).toBe(404);
    const hijack = await call("/sessions", {
      method: "POST",
      headers: as(bob),
      json: { id, bookId, date: "2026-03-03" },
    });
    expect(hijack.status).toBe(404);
    const still = await call(`/sessions/${id}`, { headers: as(alice) });
    expect(still.status).toBe(200);
  });
});
