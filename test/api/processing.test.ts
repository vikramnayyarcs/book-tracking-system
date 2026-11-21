import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { groqSpeech, groqText } from "../../packages/core/src/ai/index.ts";
import { createDb } from "../../packages/core/src/api/index.ts";
import {
  loadProcessInfo,
  planProcessing,
  runProcessing,
} from "../../packages/core/src/processing.ts";
import chat from "../../packages/core/src/ai/fixtures/groq-chat-extraction.json" with { type: "json" };
import { sessionTokenFor } from "./clerk.ts";
import { call, expectMatchesContract } from "./harness.ts";

const databaseUrl = process.env["DATABASE_URL"] ?? "";
const admin = postgres(databaseUrl, { prepare: false, max: 1 });
const db = createDb(databaseUrl);

type TestUser = { userId: string; token: string };
let alice: TestUser;
let bob: TestUser;
const as = (user: TestUser) => ({ authorization: `Bearer ${user.token}` });

const PROC_USER = "bt-test-processing-user";
const server = setupServer();

const withUser = async <T>(work: Parameters<typeof db.asUser<T>>[2]) =>
  (await db.asUser(PROC_USER, "plus", work)).result;

const clean = async () => {
  await admin`delete from app.books where title like 'Invented processing test%'`;
  await admin`delete from app.users where id = ${PROC_USER}`;
};

beforeAll(async () => {
  alice = await sessionTokenFor("bt-test-alice");
  bob = await sessionTokenFor("bt-test-bob");
  await clean();
});

afterAll(async () => {
  await clean();
  await admin.end();
});

const makeSession = async (user: TestUser, noteText?: string) => {
  const book = await call("/books", {
    method: "POST",
    headers: as(user),
    json: { title: "Invented processing test book" },
  });
  const bookId = ((await book.json()) as { id: string }).id;
  const id = crypto.randomUUID();
  await call("/sessions", {
    method: "POST",
    headers: as(user),
    json: {
      id,
      bookId,
      date: "2026-03-01",
      ...(noteText === undefined ? {} : { noteText }),
    },
  });
  return id;
};

describe("POST /sessions/{id}/process through the api function", () => {
  it("returns 202, fails cleanly when the provider is unreachable, and can run again", async () => {
    const id = await makeSession(alice, "An invented note about tides.");
    const started = await call(`/sessions/${id}/process`, {
      method: "POST",
      headers: as(alice),
    });
    expect(started.status).toBe(202);
    await expectMatchesContract(started, "POST", "/sessions/{id}/process");

    await expect
      .poll(async () => {
        const response = await call(`/sessions/${id}`, { headers: as(alice) });
        return (await response.json()) as { status: string; errorCode: string };
      })
      .toMatchObject({ status: "failed", errorCode: "ai_provider_error" });

    const again = await call(`/sessions/${id}/process`, {
      method: "POST",
      headers: as(alice),
    });
    expect(again.status).toBe(202);
  });

  it("returns 422 for a session with no note and no audio", async () => {
    const id = await makeSession(alice);
    const response = await call(`/sessions/${id}/process`, {
      method: "POST",
      headers: as(alice),
    });
    expect(response.status).toBe(422);
    await expectMatchesContract(response, "POST", "/sessions/{id}/process");
  });

  it("returns 401 without a token and 404 for user B", async () => {
    const id = await makeSession(alice, "An invented note.");
    const anonymous = await call(`/sessions/${id}/process`, { method: "POST" });
    expect(anonymous.status).toBe(401);
    const other = await call(`/sessions/${id}/process`, {
      method: "POST",
      headers: as(bob),
    });
    expect(other.status).toBe(404);
    const after = await call(`/sessions/${id}`, { headers: as(alice) });
    expect(((await after.json()) as { status: string }).status).toBe("draft");
  });
});

const seed = () =>
  withUser(async (sql) => {
    const [book] = await sql<{ id: string }[]>`
      insert into app.books (title) values ('Invented processing test run')
      returning id
    `;
    const [session] = await sql<{ id: string }[]>`
      insert into app.sessions (book_id, date, note_text)
      values (${book?.id ?? ""}, '2026-03-01', 'An invented note about tides.')
      returning id
    `;
    return session?.id ?? "";
  });

const objects = {
  download: () => Promise.reject(new Error("not used for typed notes")),
  remove: () => Promise.resolve(),
  signedUploadUrl: () => Promise.reject(new Error("not used")),
};

describe("runProcessing with recorded Groq responses", () => {
  beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
  afterAll(() => server.close());

  const speech = groqSpeech({ apiKey: "test" });
  const text = groqText({ apiKey: "test", model: "recorded" });
  it("stores AI insights and quotes, counts usage, and marks the session ready", async () => {
    server.use(
      http.post("https://api.groq.com/openai/v1/chat/completions", () =>
        HttpResponse.json(chat),
      ),
    );
    const id = await seed();
    const { info, tier } = await withUser(async (sql) => ({
      info: await loadProcessInfo(sql, id),
      tier: "plus" as const,
    }));
    if (info === undefined) {
      throw new Error("session missing");
    }
    const plan = planProcessing(info, tier);
    expect(plan).toEqual({ kind: "ready", transcribe: false });

    const outcome = await runProcessing({
      withUser,
      objects,
      speech,
      text,
      tier,
      info,
      transcribe: false,
    });
    expect(outcome).toBe("ready");

    const rows = await withUser(
      (sql) => sql<{ kind: string; source: string; page: number | null }[]>`
        select kind, source, page from app.insights
        where session_id = ${id} order by kind, created_at
      `,
    );
    expect(rows.filter((r) => r.kind === "insight")).toHaveLength(3);
    expect(rows.find((r) => r.kind === "quote")?.page).toBe(41);
    expect(rows.every((r) => r.source === "ai")).toBe(true);

    const [state] = await withUser(
      (sql) => sql<{ status: string; tokens: string }[]>`
        select s.status,
          (select ai_input_tokens::text from app.usage limit 1) as tokens
        from app.sessions s where s.id = ${id}
      `,
    );
    expect(state?.status).toBe("ready");
    expect(Number(state?.tokens)).toBeGreaterThan(0);
  });

  it("marks the session failed with an error code when the provider returns 429", async () => {
    server.use(
      http.post(
        "https://api.groq.com/openai/v1/chat/completions",
        () => new HttpResponse(null, { status: 429 }),
      ),
    );
    const id = await seed();
    const info = await withUser((sql) => loadProcessInfo(sql, id));
    if (info === undefined) {
      throw new Error("session missing");
    }
    const outcome = await runProcessing({
      withUser,
      objects,
      speech,
      text,
      tier: "plus",
      info,
      transcribe: false,
    });
    expect(outcome).toBe("ai_rate_limited");
    const [state] = await withUser(
      (sql) => sql<{ status: string; error_code: string }[]>`
        select status, error_code from app.sessions where id = ${id}
      `,
    );
    expect(state).toEqual({ status: "failed", error_code: "ai_rate_limited" });
  });
});
