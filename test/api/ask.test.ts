import { http, HttpResponse, passthrough } from "msw";
import { setupServer } from "msw/node";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { groqText } from "../../packages/core/src/ai/index.ts";
import { createDb } from "../../packages/core/src/api/index.ts";
import { answerQuestion, retrieveNotes } from "../../packages/core/src/ask.ts";
import chat from "../../packages/core/src/ai/fixtures/groq-chat-ask.json" with { type: "json" };
import { sessionTokenFor } from "./clerk.ts";
import { baseUrl, call, expectMatchesContract } from "./harness.ts";

const databaseUrl = process.env["DATABASE_URL"] ?? "";
const admin = postgres(databaseUrl, { prepare: false, max: 1 });
const db = createDb(databaseUrl);

type TestUser = { userId: string; token: string };
let alice: TestUser;
let bob: TestUser;
let counter: TestUser;
const as = (user: TestUser) => ({ authorization: `Bearer ${user.token}` });
const ask = (user: TestUser, json: unknown) =>
  call("/ask", { method: "POST", headers: as(user), json });

const server = setupServer(
  http.all(`${baseUrl}/*`, () => passthrough()),
  http.post("https://api.groq.com/openai/v1/chat/completions", () =>
    HttpResponse.json(chat),
  ),
);

const clean = () =>
  admin`delete from app.books where title like 'Invented ask test%'`;

beforeAll(async () => {
  alice = await sessionTokenFor("bt-test-alice");
  bob = await sessionTokenFor("bt-test-bob");
  counter = await sessionTokenFor("bt-test-ask-counter");
  await clean();
});

afterAll(async () => {
  await clean();
  await admin`delete from app.usage where user_id = ${counter.userId}`;
  await admin.end();
});

const makeBook = async (user: TestUser) => {
  const response = await call("/books", {
    method: "POST",
    headers: as(user),
    json: { title: "Invented ask test book" },
  });
  return ((await response.json()) as { id: string }).id;
};

const makeInsight = async (user: TestUser, bookId: string, text: string) => {
  const session = await call("/sessions", {
    method: "POST",
    headers: as(user),
    json: {
      id: crypto.randomUUID(),
      bookId,
      date: "2026-03-01",
      noteText: "Invented session note.",
    },
  });
  const sessionId = ((await session.json()) as { id: string }).id;
  const response = await call(`/books/${bookId}/insights`, {
    method: "POST",
    headers: as(user),
    json: { text, sessionId },
  });
  return {
    sessionId,
    insightId: ((await response.json()) as { id: string }).id,
  };
};

const unit = (index: number) => {
  const values = Array.from({ length: 384 }, () => 0);
  values[index] = 1;
  return values;
};

const withUser = async <T>(
  user: TestUser,
  work: Parameters<typeof db.asUser<T>>[2],
) => (await db.asUser(user.userId, "plus", work)).result;

describe("POST /ask", () => {
  it("rejects a missing question, a long question and a bad book ID", async () => {
    for (const json of [
      {},
      { question: "" },
      { question: "x".repeat(501) },
      { question: "ok", bookId: "nope" },
      { question: "ok", extra: true },
    ]) {
      const response = await ask(alice, json);
      expect(response.status).toBe(400);
      await expectMatchesContract(response, "POST", "/ask");
    }
  });

  it("rejects a call without a token", async () => {
    const response = await call("/ask", {
      method: "POST",
      json: { question: "ok" },
    });
    expect(response.status).toBe(401);
    await expectMatchesContract(response, "POST", "/ask");
  });

  it("says not in your notes when nothing matches, and counts the question", async () => {
    const response = await ask(counter, {
      question: "Qwxyzzy plughfrob vandelay?",
    });
    expect(response.status).toBe(200);
    const body = (await expectMatchesContract(response, "POST", "/ask")) as {
      answered: boolean;
      answer: string;
      citations: unknown[];
      warn: boolean;
    };
    expect(body).toEqual({
      answered: false,
      answer: "This is not in your notes.",
      citations: [],
      warn: false,
    });
    const [row] = await admin<{ vault_questions: number }[]>`
      select vault_questions from app.usage where user_id = ${counter.userId}
    `;
    expect(row?.vault_questions).toBe(1);
  });

  it("refuses with tier_limit_reached once the monthly cap is used", async () => {
    await admin`
      update app.usage set vault_questions = 200
      where user_id = ${counter.userId}
    `;
    const response = await ask(counter, { question: "Anything at all?" });
    expect(response.status).toBe(403);
    const body = (await expectMatchesContract(response, "POST", "/ask")) as {
      code: string;
    };
    expect(body.code).toBe("tier_limit_reached");
  });

  it("returns 404 for a book that is not the caller's, and for no one's", async () => {
    const aliceBook = await makeBook(alice);
    const foreign = await ask(bob, { question: "ok", bookId: aliceBook });
    expect(foreign.status).toBe(404);
    await expectMatchesContract(foreign, "POST", "/ask");
    const missing = await ask(bob, {
      question: "ok",
      bookId: crypto.randomUUID(),
    });
    expect(missing.status).toBe(404);
  });

  it("does not leak the other user's notes", async () => {
    const aliceBook = await makeBook(alice);
    await makeInsight(alice, aliceBook, "Zebrafinch songs are learned.");
    const response = await ask(bob, {
      question: "What about zebrafinch songs?",
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      answered: boolean;
      citations: unknown[];
    };
    expect(body.answered).toBe(false);
    expect(body.citations).toEqual([]);
  });
});

describe("retrieval and answer", () => {
  beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
  afterAll(() => server.close());

  it("finds notes by full text, cites book and session, and answers from a recorded response", async () => {
    const bookId = await makeBook(alice);
    const { sessionId, insightId } = await makeInsight(
      alice,
      bookId,
      "Zebrafinch songs are learned, not inherited.",
    );
    const question = "How do zebrafinches get their songs?";
    const retrieved = await withUser(alice, (sql) =>
      retrieveNotes(sql, { question, bookId, embedding: null }),
    );
    expect(retrieved.map((note) => note.insightId)).toEqual([insightId]);
    const { result } = await answerQuestion(
      groqText({ apiKey: "test", model: "recorded" }),
      question,
      retrieved,
    );
    expect(result.answered).toBe(true);
    expect(result.citations[0]).toMatchObject({
      bookId,
      bookTitle: "Invented ask test book",
      sessionId,
      sessionDate: "2026-03-01",
    });
  });

  it("finds a note by vector similarity alone and ignores distant vectors", async () => {
    const bookId = await makeBook(alice);
    const { insightId } = await makeInsight(
      alice,
      bookId,
      "Tidal charts are promises.",
    );
    await admin`
      update app.insights set embedding = ${`[${unit(0).join(",")}]`}::extensions.vector
      where id = ${insightId}
    `;
    const near = await withUser(alice, (sql) =>
      retrieveNotes(sql, {
        question: "Qwxyzzy plughfrob?",
        bookId,
        embedding: unit(0),
      }),
    );
    expect(near.map((note) => note.insightId)).toEqual([insightId]);
    const far = await withUser(alice, (sql) =>
      retrieveNotes(sql, {
        question: "Qwxyzzy plughfrob?",
        bookId,
        embedding: unit(1),
      }),
    );
    expect(far).toEqual([]);
    const other = await withUser(bob, (sql) =>
      retrieveNotes(sql, {
        question: "Qwxyzzy plughfrob?",
        embedding: unit(0),
      }),
    );
    expect(other).toEqual([]);
  });

  it("limits retrieval to one book when bookId is given", async () => {
    const first = await makeBook(alice);
    const second = await makeBook(alice);
    await makeInsight(alice, first, "Marmoset habits shape days.");
    const { insightId } = await makeInsight(
      alice,
      second,
      "Marmoset habits shape weeks.",
    );
    const retrieved = await withUser(alice, (sql) =>
      retrieveNotes(sql, {
        question: "marmoset habits",
        bookId: second,
        embedding: null,
      }),
    );
    expect(retrieved.map((note) => note.insightId)).toEqual([insightId]);
  });
});
