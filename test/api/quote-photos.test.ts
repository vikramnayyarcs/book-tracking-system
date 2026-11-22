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
  admin`delete from app.books where title like 'Invented quote photo test%'`;

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
    json: { title: "Invented quote photo test book" },
  });
  return ((await response.json()) as { id: string }).id;
};

describe("quote photos", () => {
  it("signs an upload for the caller's own book", async () => {
    const bookId = await makeBook(alice);
    const response = await call(`/books/${bookId}/quote-photos`, {
      method: "POST",
      headers: as(alice),
    });
    expect(response.status).toBe(201);
    const upload = (await expectMatchesContract(
      response,
      "POST",
      "/books/{id}/quote-photos",
    )) as { id: string; uploadUrl: string };
    expect(upload.uploadUrl).toContain("token=");
    expect(upload.uploadUrl).toContain(
      `${alice.userId}/quote-photos/${upload.id}`,
    );
  });

  it("returns 401 without a token and 404 for another user's book", async () => {
    const bookId = await makeBook(alice);
    const anonymous = await call(`/books/${bookId}/quote-photos`, {
      method: "POST",
    });
    expect(anonymous.status).toBe(401);
    const other = await call(`/books/${bookId}/quote-photos`, {
      method: "POST",
      headers: as(bob),
    });
    expect(other.status).toBe(404);
    await expectMatchesContract(other, "POST", "/books/{id}/quote-photos");
  });

  it("returns 404 when no photo was uploaded, for any caller, and 401 without a token", async () => {
    const bookId = await makeBook(alice);
    const upload = (await (
      await call(`/books/${bookId}/quote-photos`, {
        method: "POST",
        headers: as(alice),
      })
    ).json()) as { id: string };
    const missing = await call(`/quote-photos/${upload.id}/ocr`, {
      method: "POST",
      headers: as(alice),
    });
    expect(missing.status).toBe(404);
    await expectMatchesContract(missing, "POST", "/quote-photos/{id}/ocr");
    const other = await call(`/quote-photos/${upload.id}/ocr`, {
      method: "POST",
      headers: as(bob),
    });
    expect(other.status).toBe(404);
    const anonymous = await call(`/quote-photos/${upload.id}/ocr`, {
      method: "POST",
    });
    expect(anonymous.status).toBe(401);
    const badId = await call("/quote-photos/not-a-uuid/ocr", {
      method: "POST",
      headers: as(alice),
    });
    expect(badId.status).toBe(404);
  });

  it("saves a chosen passage as a quote with a page number", async () => {
    const bookId = await makeBook(alice);
    const response = await call(`/books/${bookId}/insights`, {
      method: "POST",
      headers: as(alice),
      json: {
        kind: "quote",
        text: "The sea, he said, kept better accounts than any bank in the valley.",
        page: 12,
      },
    });
    expect(response.status).toBe(201);
    const quote = (await expectMatchesContract(
      response,
      "POST",
      "/books/{id}/insights",
    )) as { kind: string; page: number };
    expect(quote).toMatchObject({ kind: "quote", page: 12 });
  });
});
