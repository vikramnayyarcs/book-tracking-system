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
  admin`delete from app.books where title like 'Invented export test%'`;

beforeAll(async () => {
  alice = await sessionTokenFor("bt-test-alice");
  bob = await sessionTokenFor("bt-test-bob");
  await clean();
});

afterAll(async () => {
  await clean();
  await admin.end();
});

const seed = async (user: TestUser, title: string) => {
  const created = await call("/books", {
    method: "POST",
    headers: as(user),
    json: { title },
  });
  const { id } = (await created.json()) as { id: string };
  await call("/sessions", {
    method: "POST",
    headers: as(user),
    json: {
      id: crypto.randomUUID(),
      bookId: id,
      date: "2026-03-01",
      noteText: "An invented export note.",
    },
  });
  await call(`/books/${id}/insights`, {
    method: "POST",
    headers: as(user),
    json: { text: "An invented export insight." },
  });
  return id;
};

type Exported = {
  books: {
    id: string;
    title: string;
    sessions: unknown[];
    insights: unknown[];
  }[];
};

describe("export", () => {
  it("returns the caller's books as a JSON download", async () => {
    const id = await seed(alice, "Invented export test alice");
    const response = await call("/export?format=json", { headers: as(alice) });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toContain("attachment");
    const body = (await expectMatchesContract(
      response,
      "GET",
      "/export",
    )) as Exported;
    const book = body.books.find((b) => b.id === id);
    expect(book?.sessions).toHaveLength(1);
    expect(book?.insights).toHaveLength(1);
  });

  it("returns Markdown with a section per book", async () => {
    await seed(alice, "Invented export test markdown");
    const response = await call("/export?format=markdown", {
      headers: as(alice),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/markdown");
    const text = await response.text();
    expect(text).toContain("## Invented export test markdown");
    expect(text).toContain("An invented export note.");
  });

  it("rejects a bad format and a missing token", async () => {
    const bad = await call("/export?format=zip", { headers: as(alice) });
    expect(bad.status).toBe(400);
    await expectMatchesContract(bad, "GET", "/export");
    const anonymous = await call("/export?format=json");
    expect(anonymous.status).toBe(401);
  });

  it("never includes user A's books in user B's export", async () => {
    await seed(alice, "Invented export test private");
    const response = await call("/export?format=json", { headers: as(bob) });
    const body = (await response.json()) as Exported;
    expect(body.books.map((b) => b.title)).not.toContain(
      "Invented export test private",
    );
    const markdown = await call("/export?format=markdown", {
      headers: as(bob),
    });
    expect(await markdown.text()).not.toContain("Invented export test private");
  });
});
