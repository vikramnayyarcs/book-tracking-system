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

const as = (secret: string) => ({ authorization: `Bearer ${secret}` });

const clean = () =>
  admin`delete from app.api_tokens where name like 'Invented tokens test%'`;

beforeAll(async () => {
  alice = await sessionTokenFor("bt-test-alice");
  bob = await sessionTokenFor("bt-test-bob");
  await clean();
});

afterAll(async () => {
  await clean();
  await admin.end();
});

const create = async (user: TestUser, scopes: string[]) => {
  const response = await call("/tokens", {
    method: "POST",
    headers: as(user.token),
    json: { name: "Invented tokens test", scopes },
  });
  expect(response.status).toBe(201);
  return (await expectMatchesContract(response, "POST", "/tokens")) as {
    id: string;
    token: string;
  };
};

describe("personal access tokens", () => {
  it("needs a Clerk token to manage tokens", async () => {
    expect((await call("/tokens")).status).toBe(401);
    const made = await create(alice, ["books:read"]);
    const response = await call("/tokens", { headers: as(made.token) });
    expect(response.status).toBe(403);
    const body = (await expectMatchesContract(response, "GET", "/tokens")) as {
      code: string;
    };
    expect(body.code).toBe("insufficient_scope");
  });

  it("rejects a bad body", async () => {
    const response = await call("/tokens", {
      method: "POST",
      headers: as(alice.token),
      json: { name: "Invented tokens test", scopes: ["admin"] },
    });
    expect(response.status).toBe(400);
    await expectMatchesContract(response, "POST", "/tokens");
  });

  it("shows the secret once and stores only its hash", async () => {
    const made = await create(alice, ["books:read"]);
    expect(made.token).toMatch(/^btp_/);
    const stored =
      await admin`select token_hash from app.api_tokens where id = ${made.id}`;
    expect(stored[0]?.["token_hash"]).not.toContain(made.token);
    const listed = await call("/tokens", { headers: as(alice.token) });
    const body = (await expectMatchesContract(listed, "GET", "/tokens")) as {
      items: Record<string, unknown>[];
    };
    expect(body.items.some((item) => item["id"] === made.id)).toBe(true);
    expect(JSON.stringify(body)).not.toContain(made.token);
  });

  it("allows only the scopes it was given", async () => {
    const reader = await create(alice, ["books:read"]);
    const list = await call("/books", { headers: as(reader.token) });
    expect(list.status).toBe(200);
    await expectMatchesContract(list, "GET", "/books");
    const write = await call("/books", {
      method: "POST",
      headers: as(reader.token),
      json: { title: "Invented tokens test book" },
    });
    expect(write.status).toBe(403);
  });

  it("records last use", async () => {
    const made = await create(alice, ["books:read"]);
    await call("/books", { headers: as(made.token) });
    const rows =
      await admin`select last_used_at from app.api_tokens where id = ${made.id}`;
    expect(rows[0]?.["last_used_at"]).not.toBeNull();
  });

  it("stops working once revoked", async () => {
    const made = await create(alice, ["books:read"]);
    const revoke = await call(`/tokens/${made.id}`, {
      method: "DELETE",
      headers: as(alice.token),
    });
    expect(revoke.status).toBe(204);
    const after = await call("/books", { headers: as(made.token) });
    expect(after.status).toBe(401);
    const again = await call(`/tokens/${made.id}`, {
      method: "DELETE",
      headers: as(alice.token),
    });
    expect(again.status).toBe(404);
  });

  it("rejects an unknown token", async () => {
    const response = await call("/books", {
      headers: as("btp_notarealtoken"),
    });
    expect(response.status).toBe(401);
  });

  it("keeps tokens private: user B cannot list or revoke user A's token", async () => {
    const made = await create(alice, ["books:read"]);
    const listed = await call("/tokens", { headers: as(bob.token) });
    const body = (await listed.json()) as { items: { id: string }[] };
    expect(body.items.some((item) => item.id === made.id)).toBe(false);
    const revoke = await call(`/tokens/${made.id}`, {
      method: "DELETE",
      headers: as(bob.token),
    });
    expect(revoke.status).toBe(404);
    await expectMatchesContract(revoke, "DELETE", "/tokens/{id}");
    const still = await call("/books", { headers: as(made.token) });
    expect(still.status).toBe(200);
  });

  it("acts as the token's owner: a token of user A never sees user B's books", async () => {
    const reader = await create(alice, ["books:read"]);
    const bobBook = await call("/books", {
      method: "POST",
      headers: as(bob.token),
      json: { title: "Invented tokens test bob book" },
    });
    const { id } = (await bobBook.json()) as { id: string };
    const fetched = await call(`/books/${id}`, { headers: as(reader.token) });
    expect(fetched.status).toBe(404);
    await admin`delete from app.books where id = ${id}`;
  });
});
