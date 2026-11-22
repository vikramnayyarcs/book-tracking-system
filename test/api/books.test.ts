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
  admin`delete from app.books where title like 'Invented books test%'`;

beforeAll(async () => {
  alice = await sessionTokenFor("bt-test-alice");
  bob = await sessionTokenFor("bt-test-bob");
  await clean();
});

afterAll(async () => {
  await clean();
  await admin.end();
});

const createBook = async (user: TestUser, json: unknown) => {
  const response = await call("/books", {
    method: "POST",
    headers: as(user),
    json,
  });
  return response;
};

describe("books", () => {
  it("creates, gets, lists, changes and deletes a book", async () => {
    const created = await createBook(alice, {
      title: "Invented books test one",
      author: "Sample Author",
      pageCount: 120,
    });
    expect(created.status).toBe(201);
    const book = (await expectMatchesContract(created, "POST", "/books")) as {
      id: string;
      status: string;
    };
    expect(book.status).toBe("reading");

    const got = await call(`/books/${book.id}`, { headers: as(alice) });
    expect(got.status).toBe(200);
    await expectMatchesContract(got, "GET", "/books/{id}");

    const listed = await call("/books?status=reading", { headers: as(alice) });
    const list = (await expectMatchesContract(listed, "GET", "/books")) as {
      items: { id: string }[];
    };
    expect(list.items.map((item) => item.id)).toContain(book.id);

    const patched = await call(`/books/${book.id}`, {
      method: "PATCH",
      headers: as(alice),
      json: {
        status: "finished",
        finishedOn: "2026-02-01",
        finishedPrecision: "month",
        author: null,
      },
    });
    expect(patched.status).toBe(200);
    expect(
      await expectMatchesContract(patched, "PATCH", "/books/{id}"),
    ).toMatchObject({
      status: "finished",
      finishedOn: "2026-02-01",
      author: null,
    });

    const deleted = await call(`/books/${book.id}`, {
      method: "DELETE",
      headers: as(alice),
    });
    expect(deleted.status).toBe(204);
    const gone = await call(`/books/${book.id}`, { headers: as(alice) });
    expect(gone.status).toBe(404);
    await expectMatchesContract(gone, "GET", "/books/{id}");
  });

  it("adds a past book with a finish date and precision", async () => {
    const created = await createBook(alice, {
      title: "Invented books test past",
      status: "finished",
      addedRetrospectively: true,
      finishedOn: "2020-06-15",
      finishedPrecision: "year",
    });
    expect(created.status).toBe(201);
    expect(
      await expectMatchesContract(created, "POST", "/books"),
    ).toMatchObject({ addedRetrospectively: true, finishedPrecision: "year" });
  });

  it("rejects invalid bodies with a problem", async () => {
    const response = await createBook(alice, { title: "" });
    expect(response.status).toBe(400);
    const problem = (await expectMatchesContract(
      response,
      "POST",
      "/books",
    )) as {
      code: string;
    };
    expect(problem.code).toBe("validation_failed");
  });

  it("requires a token", async () => {
    const response = await call("/books");
    expect(response.status).toBe(401);
  });

  it("keeps user A's books from user B", async () => {
    const created = await createBook(alice, {
      title: "Invented books test private",
    });
    const book = (await created.json()) as { id: string };

    const listed = await call("/books", { headers: as(bob) });
    const list = (await listed.json()) as { items: { id: string }[] };
    expect(list.items.map((item) => item.id)).not.toContain(book.id);

    const got = await call(`/books/${book.id}`, { headers: as(bob) });
    expect(got.status).toBe(404);

    const patched = await call(`/books/${book.id}`, {
      method: "PATCH",
      headers: as(bob),
      json: { title: "Invented books test stolen" },
    });
    expect(patched.status).toBe(404);

    const deleted = await call(`/books/${book.id}`, {
      method: "DELETE",
      headers: as(bob),
    });
    expect(deleted.status).toBe(404);

    const still = await call(`/books/${book.id}`, { headers: as(alice) });
    expect(((await still.json()) as { title: string }).title).toBe(
      "Invented books test private",
    );
  });
});

describe("GET /lookup/isbn/{isbn}", () => {
  it("rejects an invalid ISBN with a problem", async () => {
    const response = await call("/lookup/isbn/123", { headers: as(alice) });
    expect(response.status).toBe(400);
    const problem = (await expectMatchesContract(
      response,
      "GET",
      "/lookup/isbn/{isbn}",
    )) as { code: string };
    expect(problem.code).toBe("isbn_invalid");
  });
});

describe("GET /lookup/books", () => {
  it("rejects a short query with a problem", async () => {
    const response = await call("/lookup/books?q=a", { headers: as(alice) });
    expect(response.status).toBe(400);
    const problem = (await expectMatchesContract(
      response,
      "GET",
      "/lookup/books",
    )) as { code: string };
    expect(problem.code).toBe("validation_failed");
  });

  it("returns 401 without a token", async () => {
    const response = await call("/lookup/books?q=fantastic fox");
    expect(response.status).toBe(401);
    await expectMatchesContract(response, "GET", "/lookup/books");
  });
});
