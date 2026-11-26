import { AiError, type SpeechToText, type TextModel } from "./ai/types.ts";
import { extractInsights } from "./ai/insights.ts";
import type { Sql } from "./api/db.ts";
import { mayTranscribe } from "./limits.ts";
import { PLANS, type Tier } from "./plans.ts";
import type { ObjectStore } from "./api/storage.ts";
import {
  embedOnWrite,
  type Embeddings,
  type PendingInsight,
} from "./embeddings.ts";

export type ProcessInfo = {
  id: string;
  bookId: string;
  status: string;
  noteText: string | null;
  audioPath: string | null;
  audioSeconds: number | null;
  bookTitle: string;
  bookAuthor: string | null;
  voiceSecondsUsed: number;
  booksWithVoice: number;
  bookHasOtherVoice: boolean;
};

export const MAX_AUDIO_BYTES_PER_SECOND = 64 * 1024;

export const audioFitsDuration = (bytes: number, seconds: number | null) =>
  seconds !== null &&
  seconds > 0 &&
  bytes <= seconds * MAX_AUDIO_BYTES_PER_SECOND;

const STARTABLE = ["draft", "uploaded", "failed"];

export const planProcessing = (info: ProcessInfo, tier: Tier) => {
  if (!STARTABLE.includes(info.status)) {
    return { kind: "conflict" } as const;
  }
  if (info.noteText !== null && info.noteText.trim() !== "") {
    return { kind: "ready", transcribe: false } as const;
  }
  if (info.audioPath === null || info.audioSeconds === null) {
    return { kind: "nothing" } as const;
  }
  const decision = mayTranscribe({
    tier,
    usage: { voiceSeconds: info.voiceSecondsUsed, vaultQuestions: 0 },
    noteSeconds: info.audioSeconds,
    booksWithVoice: info.booksWithVoice,
    bookAlreadyHasVoice: info.bookHasOtherVoice,
  });
  return decision.allowed
    ? ({ kind: "ready", transcribe: true } as const)
    : ({ kind: "denied", reason: decision.reason } as const);
};

type InfoRow = {
  id: string;
  book_id: string;
  status: string;
  note_text: string | null;
  audio_path: string | null;
  audio_seconds: number | null;
  title: string;
  author: string | null;
  voice_seconds: number;
  books_with_voice: number;
  book_has_other_voice: boolean;
};

export const loadProcessInfo = async (sql: Sql, id: string) => {
  const rows = await sql<InfoRow[]>`
    select s.id, s.book_id, s.status, s.note_text, s.audio_path, s.audio_seconds,
      b.title, b.author,
      coalesce((select voice_seconds from app.usage
        where month = date_trunc('month', now() at time zone 'UTC')::date), 0)::int
        as voice_seconds,
      (select count(distinct book_id) from app.sessions
        where note_source = 'voice' and status = 'ready')::int as books_with_voice,
      exists (select 1 from app.sessions o
        where o.book_id = s.book_id and o.id <> s.id
          and o.note_source = 'voice' and o.status = 'ready') as book_has_other_voice
    from app.sessions s join app.books b on b.id = s.book_id
    where s.id = ${id}
  `;
  const row = rows[0];
  return row === undefined
    ? undefined
    : ({
        id: row.id,
        bookId: row.book_id,
        status: row.status,
        noteText: row.note_text,
        audioPath: row.audio_path,
        audioSeconds: row.audio_seconds,
        bookTitle: row.title,
        bookAuthor: row.author,
        voiceSecondsUsed: row.voice_seconds,
        booksWithVoice: row.books_with_voice,
        bookHasOtherVoice: row.book_has_other_voice,
      } satisfies ProcessInfo);
};

export const markStatus = async (
  sql: Sql,
  id: string,
  status: string,
  errorCode: string | null = null,
) => {
  await sql`
    update app.sessions set status = ${status}, error_code = ${errorCode}
    where id = ${id}
  `;
};

const audioFilename = (path: string) => path.split("/").pop() ?? "note.m4a";

export const runProcessing = async (input: {
  withUser: <T>(work: (sql: Sql) => Promise<T>) => Promise<T>;
  objects: ObjectStore;
  speech: SpeechToText;
  text: TextModel;
  embeddings: Embeddings;
  tier: Tier;
  info: ProcessInfo;
  transcribe: boolean;
}) => {
  const { withUser, info } = input;
  try {
    let note = info.noteText ?? "";
    if (input.transcribe && info.audioPath !== null) {
      await withUser((sql) => markStatus(sql, info.id, "transcribing"));
      const audio = await input.objects.download("audio", info.audioPath);
      if (!audioFitsDuration(audio.size, info.audioSeconds)) {
        await input.objects.remove("audio", [info.audioPath]);
        throw new Error("audio_exceeds_declared_duration");
      }
      const { text } = await input.speech.transcribe(
        audio,
        audioFilename(info.audioPath),
      );
      note = text.trim();
      const keepAudio = PLANS[input.tier].keepAudio;
      await withUser(async (sql) => {
        await sql`
          update app.sessions
          set note_text = ${note}, note_source = 'voice',
            audio_path = ${keepAudio ? info.audioPath : null}
          where id = ${info.id}
        `;
        await sql`select app.record_usage(${info.audioSeconds ?? 0}::integer)`;
      });
      if (!keepAudio) {
        await input.objects.remove("audio", [info.audioPath]);
      }
      if (note === "") {
        throw new AiError("ai_bad_output");
      }
    }
    await withUser((sql) => markStatus(sql, info.id, "extracting"));
    const result = await extractInsights(input.text, note, {
      title: info.bookTitle,
      author: info.bookAuthor,
    });
    const written: PendingInsight[] = [];
    await withUser(async (sql) => {
      for (const insight of result.insights) {
        const rows = await sql<PendingInsight[]>`
          insert into app.insights (book_id, session_id, kind, text, source)
          values (${info.bookId}, ${info.id}, 'insight', ${insight.text}, 'ai')
          returning id, text
        `;
        written.push(...rows);
      }
      for (const quote of result.quotes) {
        const rows = await sql<PendingInsight[]>`
          insert into app.insights (book_id, session_id, kind, text, source, page)
          values (${info.bookId}, ${info.id}, 'quote', ${quote.text}, 'ai', ${quote.page})
          returning id, text
        `;
        written.push(...rows);
      }
      await sql`
        select app.record_usage(
          0, 0, ${result.usage.inputTokens}::bigint, ${result.usage.outputTokens}::bigint
        )
      `;
      await markStatus(sql, info.id, "ready");
    });
    await embedOnWrite(input.embeddings, written);
    return "ready" as const;
  } catch (error) {
    const code = error instanceof AiError ? error.code : "processing_failed";
    await withUser((sql) => markStatus(sql, info.id, "failed", code));
    return code;
  }
};
