import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sessionTokenFor } from "./clerk.ts";
import { startGroqStandIn } from "./groq-stand-in.ts";
import { call, expectMatchesContract } from "./harness.ts";

const admin = postgres(process.env["DATABASE_URL"] ?? "", {
  prepare: false,
  max: 1,
});
const storageUrl = process.env["STORAGE_BASE_URL"] ?? "http://127.0.0.1:54321";

let stand: Awaited<ReturnType<typeof startGroqStandIn>>;
let user: { userId: string; token: string };
const as = () => ({ authorization: `Bearer ${user.token}` });

const clean = async () => {
  await admin`delete from app.books where title like 'Invented voice test%'`;
  await admin`delete from app.users where id = 'bt-test-voice'`;
};

beforeAll(async () => {
  await clean();
  user = await sessionTokenFor("bt-test-voice");
  stand = await startGroqStandIn();
});

afterAll(async () => {
  await stand.stop();
  await clean();
  await admin.end();
});

const audioObjects = (path: string) =>
  admin<{ n: number }[]>`
    select count(*)::int as n from storage.objects
    where bucket_id = 'audio' and name = ${path}
  `.then((rows) => rows[0]?.n ?? 0);

describe("voice path through the api function, with a recorded Groq stand-in", () => {
  it("uploads audio, transcribes, extracts, and deletes the audio on the free tier", async () => {
    const book = await call("/books", {
      method: "POST",
      headers: as(),
      json: { title: "Invented voice test book" },
    });
    const bookId = ((await book.json()) as { id: string }).id;
    await admin`update app.users set tier = 'free' where id = ${user.userId}`;

    const id = crypto.randomUUID();
    await call("/sessions", {
      method: "POST",
      headers: as(),
      json: { id, bookId, date: "2026-03-04" },
    });
    const signed = await call(`/sessions/${id}/audio-upload`, {
      method: "POST",
      headers: as(),
      json: { durationSeconds: 30, extension: "m4a" },
    });
    expect(signed.status).toBe(200);
    const { uploadUrl, path } = (await signed.json()) as {
      uploadUrl: string;
      path: string;
    };

    const target = new URL(uploadUrl);
    const form = new FormData();
    form.set("cacheControl", "3600");
    form.set(
      "",
      new Blob([new Uint8Array(2048).fill(7)], { type: "audio/mp4" }),
    );
    const upload = await fetch(
      `${storageUrl}${target.pathname}${target.search}`,
      { method: "PUT", body: form },
    );
    expect(upload.ok).toBe(true);
    expect(await audioObjects(path)).toBe(1);

    const started = await call(`/sessions/${id}/process`, {
      method: "POST",
      headers: as(),
    });
    expect(started.status).toBe(202);
    await expectMatchesContract(started, "POST", "/sessions/{id}/process");

    await expect
      .poll(async () => {
        const response = await call(`/sessions/${id}`, { headers: as() });
        return (await response.json()) as { status: string };
      })
      .toMatchObject({ status: "ready" });

    const transcription = stand.seen.find((r) => r.kind === "transcription");
    expect(transcription).toMatchObject({
      model: "whisper-large-v3-turbo",
      fileName: `${id}.m4a`,
      fileBytes: 2048,
    });
    const chat = stand.seen.find((r) => r.kind === "chat");
    expect(chat?.kind === "chat" && chat.userMessage).toContain("Thank you.");

    const final = await call(`/sessions/${id}`, { headers: as() });
    expect(await final.json()).toMatchObject({
      status: "ready",
      noteText: "Thank you.",
      noteSource: "voice",
      hasAudio: false,
    });
    expect(await audioObjects(path)).toBe(0);

    const insights = await admin<{ n: number }[]>`
      select count(*)::int as n from app.insights
      where session_id = ${id} and source = 'ai'
    `;
    expect(insights[0]?.n).toBeGreaterThan(0);
  });

  it("rejects audio far larger than the declared length without calling Groq or counting minutes", async () => {
    const book = await call("/books", {
      method: "POST",
      headers: as(),
      json: { title: "Invented voice test oversize" },
    });
    const bookId = ((await book.json()) as { id: string }).id;
    const id = crypto.randomUUID();
    await call("/sessions", {
      method: "POST",
      headers: as(),
      json: { id, bookId, date: "2026-03-05" },
    });
    const signed = await call(`/sessions/${id}/audio-upload`, {
      method: "POST",
      headers: as(),
      json: { durationSeconds: 1, extension: "m4a" },
    });
    const { uploadUrl, path } = (await signed.json()) as {
      uploadUrl: string;
      path: string;
    };
    const target = new URL(uploadUrl);
    const form = new FormData();
    form.set("cacheControl", "3600");
    form.set(
      "",
      new Blob([new Uint8Array(512 * 1024).fill(7)], { type: "audio/mp4" }),
    );
    const upload = await fetch(
      `${storageUrl}${target.pathname}${target.search}`,
      { method: "PUT", body: form },
    );
    expect(upload.ok).toBe(true);
    const before = stand.seen.filter((r) => r.kind === "transcription").length;
    const usedBefore = await admin<{ n: number }[]>`
      select coalesce(sum(voice_seconds), 0)::int as n from app.usage
      where user_id = ${user.userId}
    `;

    const started = await call(`/sessions/${id}/process`, {
      method: "POST",
      headers: as(),
    });
    expect(started.status).toBe(202);
    await expect
      .poll(async () => {
        const response = await call(`/sessions/${id}`, { headers: as() });
        return (await response.json()) as { status: string };
      })
      .toMatchObject({ status: "failed" });

    expect(stand.seen.filter((r) => r.kind === "transcription").length).toBe(
      before,
    );
    const usedAfter = await admin<{ n: number }[]>`
      select coalesce(sum(voice_seconds), 0)::int as n from app.usage
      where user_id = ${user.userId}
    `;
    expect(usedAfter[0]?.n).toBe(usedBefore[0]?.n);
    expect(await audioObjects(path)).toBe(0);
  });
});
