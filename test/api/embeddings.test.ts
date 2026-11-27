import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  groqSpeech,
  groqText,
  groqVision,
  httpEmbedder,
} from "../../packages/core/src/ai/index.ts";
import {
  clerkVerifier,
  createApp,
  createDb,
  jsonLogger,
} from "../../packages/core/src/api/index.ts";
import { sessionTokenFor } from "./clerk.ts";
import { gatewaySecret } from "./harness.ts";
import { standInVector, startEmbedStandIn } from "./embed-stand-in.ts";

const databaseUrl = process.env["DATABASE_URL"] ?? "";
const admin = postgres(databaseUrl, { prepare: false, max: 1 });
const JOBS_SECRET = "test-jobs-secret";

type TestUser = { userId: string; token: string };
let alice: TestUser;
let stand: Awaited<ReturnType<typeof startEmbedStandIn>>;

const unused = () => Promise.reject(new Error("not used by these routes"));

const makeApp = (embedUrl: string) =>
  createApp({
    allowedOrigins: [],
    gatewaySecret,
    jobsSecret: JOBS_SECRET,
    logger: jsonLogger(() => undefined),
    newRequestId: () => crypto.randomUUID(),
    now: () => Date.now(),
    verifyToken: clerkVerifier(process.env["CLERK_ISSUER"] ?? ""),
    db: createDb(databaseUrl),
    defaultTier: "plus",
    objects: { download: unused, remove: unused, signedUploadUrl: unused },
    identity: { configured: false, deleteUser: unused },
    fetch: (input, init) => fetch(input, init),
    openLibraryUrl: "http://127.0.0.1:9",
    vapidPublicKey: "",
    vapidPrivateKey: "",
    vapidSubject: "",
    embedder: httpEmbedder({ url: embedUrl }),
    speech: groqSpeech({ apiKey: "test" }),
    text: groqText({ apiKey: "test", model: "recorded" }),
    vision: groqVision({ apiKey: "test", model: "recorded" }),
    waitUntil: () => undefined,
  });

let working: ReturnType<typeof makeApp>;
const broken = makeApp("http://127.0.0.1:9/embed");

const send = (
  app: ReturnType<typeof makeApp>,
  method: string,
  path: string,
  json?: unknown,
) =>
  app.fetch(
    new Request(`http://api.test/v1${path}`, {
      method,
      headers: {
        "x-gateway-secret": gatewaySecret,
        authorization: `Bearer ${alice.token}`,
        "content-type": "application/json",
      },
      ...(json === undefined ? {} : { body: JSON.stringify(json) }),
    }),
  );

const runBackfill = async (runKey: string) =>
  (
    await working.fetch(
      new Request(
        `http://api.test/internal/jobs/embed-backfill?run_key=${runKey}`,
        {
          method: "POST",
          headers: { "x-jobs-secret": JOBS_SECRET },
        },
      ),
    )
  ).json() as Promise<{ ran: boolean }>;

const clean = async () => {
  await admin`delete from app.books where title like 'Invented embeddings test%'`;
  await admin`delete from app.job_runs where run_key like 'embeddings-test-%'`;
};

beforeAll(async () => {
  await clean();
  alice = await sessionTokenFor("bt-test-alice");
  stand = await startEmbedStandIn();
  working = makeApp(stand.url);
});

afterAll(async () => {
  await stand.stop();
  await clean();
  await admin.end();
});

const makeBook = async () => {
  const response = await send(working, "POST", "/books", {
    title: "Invented embeddings test book",
  });
  return ((await response.json()) as { id: string }).id;
};

const distanceTo = async (id: string, text: string) => {
  const vector = `[${standInVector(text).join(",")}]`;
  const rows = await admin<{ d: number | null }[]>`
    select (embedding operator(extensions.<=>) ${vector}::extensions.vector)::float8 as d
    from app.insights where id = ${id}
  `;
  return rows[0]?.d ?? null;
};

describe("insight embeddings", () => {
  it("embeds on insert, re-embeds when the text changes, and leaves a pin alone", async () => {
    const bookId = await makeBook();
    const created = await send(working, "POST", `/books/${bookId}/insights`, {
      text: "Invented note: slow reading keeps details.",
    });
    expect(created.status).toBe(201);
    const { id } = (await created.json()) as { id: string };
    expect(
      await distanceTo(id, "Invented note: slow reading keeps details."),
    ).toBeLessThan(1e-6);

    const calls = stand.requests.length;
    await send(working, "PATCH", `/insights/${id}`, { pinned: true });
    expect(stand.requests.length).toBe(calls);
    expect(
      await distanceTo(id, "Invented note: slow reading keeps details."),
    ).toBeLessThan(1e-6);

    const edited = await send(working, "PATCH", `/insights/${id}`, {
      text: "Invented edit: fast reading loses details.",
    });
    expect(edited.status).toBe(200);
    expect(
      await distanceTo(id, "Invented edit: fast reading loses details."),
    ).toBeLessThan(1e-6);
    expect(
      await distanceTo(id, "Invented note: slow reading keeps details."),
    ).toBeGreaterThan(0.1);
  });

  it("keeps the row with a null embedding when the embedder is down, and clears a stale one on edit", async () => {
    const bookId = await makeBook();
    const created = await send(broken, "POST", `/books/${bookId}/insights`, {
      text: "Invented note written while the embedder is down.",
    });
    expect(created.status).toBe(201);
    const { id } = (await created.json()) as { id: string };
    const [row] = await admin<{ missing: boolean }[]>`
      select embedding is null as missing from app.insights where id = ${id}
    `;
    expect(row?.missing).toBe(true);

    await send(working, "PATCH", `/insights/${id}`, { pinned: true });
    await runBackfill(`embeddings-test-${crypto.randomUUID()}`);
    expect(
      await distanceTo(id, "Invented note written while the embedder is down."),
    ).toBeLessThan(1e-6);

    await send(broken, "PATCH", `/insights/${id}`, {
      text: "Invented edit while the embedder is down.",
    });
    const [stale] = await admin<{ missing: boolean }[]>`
      select embedding is null as missing from app.insights where id = ${id}
    `;
    expect(stale?.missing).toBe(true);
  });
});

describe("embed-backfill job", () => {
  it("embeds insights with a null embedding, and a second run does nothing", async () => {
    const bookId = await makeBook();
    const ids = await admin<{ id: string }[]>`
      insert into app.insights (user_id, book_id, text)
      select ${alice.userId}, ${bookId}, 'Invented backfill note ' || n
      from generate_series(1, 3) n
      returning id
    `;
    const first = await runBackfill(`embeddings-test-${crypto.randomUUID()}`);
    expect(first.ran).toBe(true);
    for (const [index, { id }] of ids.entries()) {
      expect(
        await distanceTo(id, `Invented backfill note ${index + 1}`),
      ).not.toBeNull();
    }
    const calls = stand.requests.length;
    const before = await admin`
      select id, embedding::text as e from app.insights
      where book_id = ${bookId} order by id
    `;

    const second = await runBackfill(`embeddings-test-${crypto.randomUUID()}`);
    expect(second.ran).toBe(true);
    expect(stand.requests.length).toBe(calls);
    const after = await admin`
      select id, embedding::text as e from app.insights
      where book_id = ${bookId} order by id
    `;
    expect(after).toEqual(before);
  });

  it("does the work once when the same run happens twice", async () => {
    const runKey = `embeddings-test-${crypto.randomUUID()}`;
    expect((await runBackfill(runKey)).ran).toBe(true);
    expect((await runBackfill(runKey)).ran).toBe(false);
  });
});
