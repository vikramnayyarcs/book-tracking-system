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
  admin`delete from app.books where title like 'Invented finish test%'`;

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
    json: { title: "Invented finish test book" },
  });
  return ((await response.json()) as { id: string }).id;
};

describe("finish flow", () => {
  it("finishes a book with a rating and review, then reads the review", async () => {
    const id = await makeBook(alice);
    const response = await call(`/books/${id}/finish`, {
      method: "POST",
      headers: as(alice),
      json: { rating: 4, review: "An invented review." },
    });
    expect(response.status).toBe(200);
    const result = (await expectMatchesContract(
      response,
      "POST",
      "/books/{id}/finish",
    )) as {
      book: { status: string; finishedOn: string; finishedPrecision: string };
      review: { rating: number; hasPhoto: boolean };
    };
    expect(result.book.status).toBe("finished");
    expect(result.book.finishedPrecision).toBe("day");
    expect(result.book.finishedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.review).toMatchObject({ rating: 4, hasPhoto: false });

    const review = await call(`/books/${id}/review`, { headers: as(alice) });
    expect(review.status).toBe(200);
    await expectMatchesContract(review, "GET", "/books/{id}/review");
  });

  it("finishes a past book with an approximate date", async () => {
    const id = await makeBook(alice);
    const response = await call(`/books/${id}/finish`, {
      method: "POST",
      headers: as(alice),
      json: { finishedOn: "2024-06-01", finishedPrecision: "month" },
    });
    const result = (await expectMatchesContract(
      response,
      "POST",
      "/books/{id}/finish",
    )) as { book: { finishedOn: string; finishedPrecision: string } };
    expect(result.book).toMatchObject({
      finishedOn: "2024-06-01",
      finishedPrecision: "month",
    });
  });

  it("signs a finish photo upload and flags the photo on the review", async () => {
    const id = await makeBook(alice);
    const response = await call(`/books/${id}/finish-photo`, {
      method: "POST",
      headers: as(alice),
      json: { extension: "jpg" },
    });
    expect(response.status).toBe(200);
    const upload = (await expectMatchesContract(
      response,
      "POST",
      "/books/{id}/finish-photo",
    )) as { path: string; uploadUrl: string };
    expect(upload.path).toBe(`${alice.userId}/${id}.jpg`);
    expect(upload.uploadUrl).toContain("token=");
    const review = (await (
      await call(`/books/${id}/review`, { headers: as(alice) })
    ).json()) as { hasPhoto: boolean };
    expect(review.hasPhoto).toBe(true);
  });

  it("rejects invalid input and a missing token", async () => {
    const id = await makeBook(alice);
    const bad = await call(`/books/${id}/finish`, {
      method: "POST",
      headers: as(alice),
      json: { rating: 9 },
    });
    expect(bad.status).toBe(400);
    await expectMatchesContract(bad, "POST", "/books/{id}/finish");
    const badPhoto = await call(`/books/${id}/finish-photo`, {
      method: "POST",
      headers: as(alice),
      json: { extension: "gif" },
    });
    expect(badPhoto.status).toBe(400);
    const anonymous = await call(`/books/${id}/finish`, {
      method: "POST",
      json: {},
    });
    expect(anonymous.status).toBe(401);
  });

  it("hides user A's book, review and photo from user B", async () => {
    const id = await makeBook(alice);
    await call(`/books/${id}/finish`, {
      method: "POST",
      headers: as(alice),
      json: { rating: 5, review: "Private review" },
    });
    const finish = await call(`/books/${id}/finish`, {
      method: "POST",
      headers: as(bob),
      json: { rating: 1 },
    });
    expect(finish.status).toBe(404);
    const review = await call(`/books/${id}/review`, { headers: as(bob) });
    expect(review.status).toBe(404);
    const photo = await call(`/books/${id}/finish-photo`, {
      method: "POST",
      headers: as(bob),
      json: { extension: "png" },
    });
    expect(photo.status).toBe(404);
    const mine = (await (
      await call(`/books/${id}/review`, { headers: as(alice) })
    ).json()) as { rating: number; text: string };
    expect(mine).toMatchObject({ rating: 5, text: "Private review" });
  });
});
