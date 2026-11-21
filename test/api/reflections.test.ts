import { http, HttpResponse, passthrough } from "msw";
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
import chat from "../../packages/core/src/ai/fixtures/groq-chat-questions.json" with { type: "json" };
import { sessionTokenFor } from "./clerk.ts";
import {
  baseUrl,
  call,
  expectMatchesContract,
  gatewaySecret,
} from "./harness.ts";

const databaseUrl = process.env["DATABASE_URL"] ?? "";
const admin = postgres(databaseUrl, { prepare: false, max: 1 });

type TestUser = { userId: string; token: string };
let alice: TestUser;
let bob: TestUser;
const as = (user: TestUser) => ({ authorization: `Bearer ${user.token}` });

const server = setupServer(
  http.all(`${baseUrl}/*`, () => passthrough()),
  http.all(`${process.env["CLERK_ISSUER"] ?? ""}/*`, () => passthrough()),
);

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
  waitUntil: () => undefined,
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
      json: { stage: "recall" },
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
