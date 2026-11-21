import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { groqSpeech, groqText } from "../../packages/core/src/ai/index.ts";
import {
  clerkVerifier,
  createApp,
  createDb,
  jsonLogger,
} from "../../packages/core/src/api/index.ts";
import extraction from "../../packages/core/src/ai/fixtures/groq-chat-extraction.json" with { type: "json" };
import chat from "../../packages/core/src/ai/fixtures/groq-chat-questions.json" with { type: "json" };
import { sessionTokenFor } from "./clerk.ts";
import { call, expectMatchesContract, gatewaySecret } from "./harness.ts";

const databaseUrl = process.env["DATABASE_URL"] ?? "";
const admin = postgres(databaseUrl, { prepare: false, max: 1 });

type TestUser = { userId: string; token: string };
let alice: TestUser;
let bob: TestUser;
const as = (user: TestUser) => ({ authorization: `Bearer ${user.token}` });

const server = setupServer();
const pending: Promise<unknown>[] = [];

const unused = () => Promise.reject(new Error("not used by these routes"));
const inProcess = createApp({
  gatewaySecret,
  logger: jsonLogger(() => undefined),
  newRequestId: () => crypto.randomUUID(),
  now: () => Date.now(),
  verifyToken: clerkVerifier(process.env["CLERK_ISSUER"] ?? ""),
  db: createDb(databaseUrl),
  defaultTier: "plus",
  objects: { download: unused, remove: unused, signedUploadUrl: unused },
  fetch: (input, init) => fetch(input, init),
  openLibraryUrl: "http://127.0.0.1:9",
  speech: groqSpeech({ apiKey: "test" }),
  text: groqText({ apiKey: "test", model: "recorded" }),
  waitUntil: (work) => {
    pending.push(work);
  },
});

const inProcessCall = (path: string, user: TestUser, json?: unknown) =>
  inProcess.fetch(
    new Request(`http://api.test/v1${path}`, {
      method: json === undefined ? "GET" : "POST",
      headers: {
        "x-gateway-secret": gatewaySecret,
        "content-type": "application/json",
        ...as(user),
      },
      ...(json === undefined ? {} : { body: JSON.stringify(json) }),
    }),
  );

const clean = () =>
  admin`delete from app.books where title like 'Invented reflections test%'`;

beforeAll(async () => {
  alice = await sessionTokenFor("bt-test-alice");
  bob = await sessionTokenFor("bt-test-bob");
  await clean();
});

afterAll(async () => {
  await clean();
  await admin.end();
});

const makeBook = async (user: TestUser, withNote: boolean) => {
  const book = await call("/books", {
    method: "POST",
    headers: as(user),
    json: { title: "Invented reflections test book" },
  });
  const bookId = ((await book.json()) as { id: string }).id;
  if (withNote) {
    await call("/sessions", {
      method: "POST",
      headers: as(user),
      json: {
        id: crypto.randomUUID(),
        bookId,
        date: "2026-03-01",
        noteText: "An invented note: routine is a form of attention.",
      },
    });
  }
  return bookId;
};

describe("reflections", () => {
  it("asks 3 questions once, returns the same ones on a second ask, and saves an answer", async () => {
    server.listen({ onUnhandledFrame: "error" });
    server.use(
      http.post("https://api.groq.com/openai/v1/chat/completions", () =>
        HttpResponse.json(chat),
      ),
    );
    try {
      const bookId = await makeBook(alice, true);
      const first = await inProcessCall(`/books/${bookId}/reflections`, alice, {
        stage: "end",
      });
      expect(first.status).toBe(201);
      const created = (await first.json()) as {
        items: { id: string; stage: string; position: number; answer: null }[];
      };
      expect(created.items.map((item) => item.position)).toEqual([1, 2, 3]);
      expect(created.items.every((item) => item.stage === "end")).toBe(true);

      const second = await inProcessCall(
        `/books/${bookId}/reflections`,
        alice,
        { stage: "end" },
      );
      expect(second.status).toBe(200);
      const again = (await second.json()) as { items: { id: string }[] };
      expect(again.items.map((item) => item.id)).toEqual(
        created.items.map((item) => item.id),
      );

      const id = created.items[0]?.id ?? "";
      const answered = await call(`/reflections/${id}`, {
        method: "PATCH",
        headers: as(alice),
        json: { answer: "An invented answer." },
      });
      expect(answered.status).toBe(200);
      const body = (await expectMatchesContract(
        answered,
        "PATCH",
        "/reflections/{id}",
      )) as { answer: string };
      expect(body.answer).toBe("An invented answer.");

      const listed = await call(`/books/${bookId}/reflections`, {
        headers: as(alice),
      });
      await expectMatchesContract(listed, "GET", "/books/{id}/reflections");

      const otherGet = await call(`/books/${bookId}/reflections`, {
        headers: as(bob),
      });
      expect(otherGet.status).toBe(404);
      const otherPatch = await call(`/reflections/${id}`, {
        method: "PATCH",
        headers: as(bob),
        json: { answer: "Bob writes on Alice's question." },
      });
      expect(otherPatch.status).toBe(404);
      const otherPost = await call(`/books/${bookId}/reflections`, {
        method: "POST",
        headers: as(bob),
        json: { stage: "mid" },
      });
      expect(otherPost.status).toBe(404);
    } finally {
      server.close();
    }
  });

  it("returns 422 when the book has no notes, 400 for a bad stage, and 401 without a token", async () => {
    const bookId = await makeBook(alice, false);
    const empty = await call(`/books/${bookId}/reflections`, {
      method: "POST",
      headers: as(alice),
      json: { stage: "end" },
    });
    expect(empty.status).toBe(422);
    const bad = await call(`/books/${bookId}/reflections`, {
      method: "POST",
      headers: as(alice),
      json: { stage: "later" },
    });
    expect(bad.status).toBe(400);
    const anonymous = await call(`/books/${bookId}/reflections`);
    expect(anonymous.status).toBe(401);
  });

  it("returns 502 ai_unavailable when the provider is unreachable", async () => {
    const bookId = await makeBook(alice, true);
    const response = await call(`/books/${bookId}/reflections`, {
      method: "POST",
      headers: as(alice),
      json: { stage: "mid" },
    });
    expect(response.status).toBe(502);
  });
});

describe("past books", () => {
  it("writes 3 recall prompts from the title alone, and turns the remembered note into insights", async () => {
    server.listen({ onUnhandledFrame: "error" });
    server.use(
      http.post(
        "https://api.groq.com/openai/v1/chat/completions",
        async ({ request }) =>
          HttpResponse.json(
            (await request.text()).includes("remember a book")
              ? chat
              : extraction,
          ),
      ),
    );
    try {
      const book = await call("/books", {
        method: "POST",
        headers: as(alice),
        json: {
          title: "Invented reflections test past book",
          status: "finished",
          finishedOn: "2019-01-01",
          finishedPrecision: "year",
          addedRetrospectively: true,
        },
      });
      expect(book.status).toBe(201);
      const bookId = ((await book.json()) as { id: string }).id;

      const recall = await inProcessCall(
        `/books/${bookId}/reflections`,
        alice,
        {
          stage: "recall",
        },
      );
      expect(recall.status).toBe(201);
      const prompts = (await recall.json()) as { items: { stage: string }[] };
      expect(prompts.items).toHaveLength(3);
      expect(prompts.items.every((item) => item.stage === "recall")).toBe(true);

      const sessionId = crypto.randomUUID();
      const created = await call("/sessions", {
        method: "POST",
        headers: as(alice),
        json: {
          id: sessionId,
          bookId,
          date: "2026-03-01",
          noteText: "An invented memory: routine is a form of attention.",
        },
      });
      expect(created.status).toBe(201);
      const started = await inProcessCall(
        `/sessions/${sessionId}/process`,
        alice,
        {},
      );
      expect(started.status).toBe(202);
      await Promise.all(pending);

      const insights = await call(`/sessions/${sessionId}/insights`, {
        headers: as(alice),
      });
      const body = (await insights.json()) as { items: { source: string }[] };
      expect(body.items.length).toBeGreaterThanOrEqual(3);
      expect(body.items.every((item) => item.source === "ai")).toBe(true);
    } finally {
      server.close();
    }
  });
});
