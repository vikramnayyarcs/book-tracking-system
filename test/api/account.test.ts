import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";
import { clerkUserExists, deleteClerkUser, sessionTokenFor } from "./clerk.ts";
import { call, expectMatchesContract } from "./harness.ts";

const admin = postgres(process.env["DATABASE_URL"] ?? "", {
  prepare: false,
  max: 1,
});
const storageUrl = process.env["STORAGE_BASE_URL"] ?? "http://127.0.0.1:54321";
const suffix = crypto.randomUUID().slice(0, 8);

type TestUser = { userId: string; token: string };
const as = (token: string) => ({ authorization: `Bearer ${token}` });
const spawned: string[] = [];

const newUser = async (label: string) => {
  const user = await sessionTokenFor(`bt-test-${label}-${suffix}`);
  spawned.push(user.userId);
  return user;
};

const remove = (user: TestUser, confirmation = "delete") =>
  call("/me", {
    method: "DELETE",
    headers: as(user.token),
    json: { confirmation },
  });

const seed = async (user: TestUser, title: string) => {
  const book = await call("/books", {
    method: "POST",
    headers: as(user.token),
    json: { title },
  });
  expect(book.status).toBe(201);
  const bookId = ((await book.json()) as { id: string }).id;
  const id = crypto.randomUUID();
  await call("/sessions", {
    method: "POST",
    headers: as(user.token),
    json: { id, bookId, date: "2026-03-04" },
  });
  const signed = await call(`/sessions/${id}/audio-upload`, {
    method: "POST",
    headers: as(user.token),
    json: { durationSeconds: 30, extension: "m4a" },
  });
  const { uploadUrl } = (await signed.json()) as { uploadUrl: string };
  const target = new URL(uploadUrl);
  const form = new FormData();
  form.set("cacheControl", "3600");
  form.set("", new Blob([new Uint8Array(512).fill(3)], { type: "audio/mp4" }));
  const upload = await fetch(
    `${storageUrl}${target.pathname}${target.search}`,
    {
      method: "PUT",
      body: form,
    },
  );
  expect(upload.ok).toBe(true);
};

const counts = async (userId: string) => {
  const rows = await admin<{ users: number; books: number; objects: number }[]>`
    select
      (select count(*)::int from app.users where id = ${userId}) as users,
      (select count(*)::int from app.books where user_id = ${userId}) as books,
      (select count(*)::int from storage.objects
        where bucket_id in ('audio', 'photos') and name like ${`${userId}/%`}) as objects
  `;
  return rows[0];
};

afterAll(async () => {
  for (const userId of spawned) {
    await admin`delete from app.users where id = ${userId}`;
    await deleteClerkUser(userId);
  }
  await admin.end();
});

describe("DELETE /v1/me", () => {
  it("needs a token", async () => {
    const response = await call("/me", {
      method: "DELETE",
      json: { confirmation: "delete" },
    });
    expect(response.status).toBe(401);
    await expectMatchesContract(response, "DELETE", "/me");
  });

  it("refuses a personal access token and deletes nothing", async () => {
    const victim = await newUser("pat");
    await call("/books", {
      method: "POST",
      headers: as(victim.token),
      json: { title: "Invented pat book" },
    });
    const made = await call("/tokens", {
      method: "POST",
      headers: as(victim.token),
      json: { name: "Invented delete test", scopes: ["books:read"] },
    });
    const { token } = (await made.json()) as { token: string };
    const response = await call("/me", {
      method: "DELETE",
      headers: as(token),
      json: { confirmation: "delete" },
    });
    expect(response.status).toBe(403);
    await expectMatchesContract(response, "DELETE", "/me");
    expect(await counts(victim.userId)).toMatchObject({ users: 1, books: 1 });
  });

  it("refuses a missing or wrong confirmation word", async () => {
    const user = await newUser("confirm");
    for (const confirmation of ["", "Delete", "yes"]) {
      const response = await remove(user, confirmation);
      expect(response.status).toBe(400);
      await expectMatchesContract(response, "DELETE", "/me");
    }
    expect((await counts(user.userId))?.users).toBe(1);
  });

  it("deletes only the caller: user A can never delete user B", async () => {
    const a = await newUser("a");
    const b = await newUser("b");
    await seed(a, "Invented delete test A");
    await seed(b, "Invented delete test B");
    const response = await remove(a);
    expect(response.status).toBe(204);
    expect(await counts(a.userId)).toEqual({ users: 0, books: 0, objects: 0 });
    expect(await counts(b.userId)).toEqual({ users: 1, books: 1, objects: 1 });
    expect(await clerkUserExists(a.userId)).toBe(false);
    expect(await clerkUserExists(b.userId)).toBe(true);
  });

  it("leaves no rows, storage objects or Clerk user, and answers 204", async () => {
    const user = await newUser("full");
    await seed(user, "Invented delete test full");
    expect(await counts(user.userId)).toEqual({
      users: 1,
      books: 1,
      objects: 1,
    });
    const response = await remove(user);
    expect(response.status).toBe(204);
    await expectMatchesContract(response, "DELETE", "/me");
    expect(await counts(user.userId)).toEqual({
      users: 0,
      books: 0,
      objects: 0,
    });
    const attempts = await admin`
      select 1 from app.deletion_attempts where user_id = ${user.userId}
    `;
    expect(attempts).toHaveLength(0);
    expect(await clerkUserExists(user.userId)).toBe(false);
  });

  it("allows at most 3 attempts per day", async () => {
    const user = await newUser("limit");
    await call("/me", { headers: as(user.token) });
    await admin`
      insert into app.deletion_attempts (user_id)
      select ${user.userId} from generate_series(1, 3)
    `;
    const response = await remove(user);
    expect(response.status).toBe(429);
    const body = (await expectMatchesContract(response, "DELETE", "/me")) as {
      code: string;
    };
    expect(body.code).toBe("deletion_limit_reached");
    expect((await counts(user.userId))?.users).toBe(1);
  });
});
