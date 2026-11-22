import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { groqText } from "../../packages/core/src/ai/index.ts";
import { createDb } from "../../packages/core/src/api/index.ts";
import { runSummary } from "../../packages/core/src/summary.ts";
import chat from "../../packages/core/src/ai/fixtures/groq-chat-summary.json" with { type: "json" };

const admin = postgres(process.env["DATABASE_URL"] ?? "", {
  prepare: false,
  max: 1,
});
const SUMMARY_USER = "bt-test-summary-run";
const server = setupServer();
const db = createDb(process.env["DATABASE_URL"] ?? "");
const withUser = async <T>(work: Parameters<typeof db.asUser<T>>[2]) =>
  (await db.asUser(SUMMARY_USER, "plus", work)).result;

const clean = async () => {
  await admin`delete from app.users where id = ${SUMMARY_USER}`;
};

beforeAll(async () => {
  await clean();
  server.listen({ onUnhandledFrame: "error" });
});

afterAll(async () => {
  server.close();
  await clean();
  await admin.end();
});

const text = groqText({ apiKey: "test", model: "recorded" });

describe("runSummary with a recorded Groq response", () => {
  it("saves the summary into the review, keeps the rating and counts usage", async () => {
    server.use(
      http.post("https://api.groq.com/openai/v1/chat/completions", () =>
        HttpResponse.json(chat),
      ),
    );
    const bookId = await withUser(async (sql) => {
      const [book] = await sql<{ id: string }[]>`
        insert into app.books (title) values ('Invented summary test run')
        returning id
      `;
      const id = book?.id ?? "";
      await sql`
        insert into app.insights (book_id, kind, text)
        values (${id}, 'insight', 'An invented insight about pear trees.')
      `;
      await sql`insert into app.reviews (book_id, rating) values (${id}, 4)`;
      return id;
    });
    const outcome = await runSummary({ withUser, text, bookId });
    expect(outcome).toMatchObject({
      kind: "saved",
      review: { rating: 4, summary: expect.stringContaining("pear orchard") },
    });
    const [usage] = await withUser(
      (sql) => sql<{ tokens: string }[]>`
        select ai_input_tokens::text as tokens from app.usage limit 1
      `,
    );
    expect(Number(usage?.tokens)).toBeGreaterThan(0);
  });

  it("does not call the AI service for a book with no notes", async () => {
    server.use(
      http.post(
        "https://api.groq.com/openai/v1/chat/completions",
        () => new HttpResponse(null, { status: 500 }),
      ),
    );
    const bookId = await withUser(async (sql) => {
      const [book] = await sql<{ id: string }[]>`
        insert into app.books (title) values ('Invented summary test empty')
        returning id
      `;
      return book?.id ?? "";
    });
    expect((await runSummary({ withUser, text, bookId })).kind).toBe("nothing");
  });
});
