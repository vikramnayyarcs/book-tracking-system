import { api } from "../api/client.ts";
import {
  advance,
  classifyStatus,
  dueEntries,
  fail,
  retryNow,
  withUploadUrl,
  type FailureKind,
  type QueueEntry,
} from "./queue-logic.ts";
import {
  getEntry,
  listEntries,
  putEntry,
  removeEntry,
  subscribeQueue,
} from "./queue-store.ts";

class StepFailure extends Error {
  kind: FailureKind;

  constructor(kind: FailureKind, message: string) {
    super(message);
    this.kind = kind;
  }
}

const offlineMessage = "No connection. Waiting to upload.";

function problemTitle(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "title" in error) {
    const title = (error as { title?: unknown }).title;
    if (typeof title === "string" && title !== "") return title;
  }
  return fallback;
}

function checkResponse(
  result: { response: Response; error?: unknown },
  allowedStatuses: readonly number[] = [],
) {
  if (result.response.ok || allowedStatuses.includes(result.response.status)) {
    return;
  }
  throw new StepFailure(
    classifyStatus(result.response.status),
    problemTitle(result.error, "The upload failed"),
  );
}

async function create(entry: QueueEntry) {
  const result = await api.POST("/sessions", {
    body: {
      id: entry.id,
      bookId: entry.bookId,
      date: entry.date,
      ...(entry.pageFrom === null ? {} : { pageFrom: entry.pageFrom }),
      ...(entry.pageTo === null ? {} : { pageTo: entry.pageTo }),
      ...(entry.chapter === null ? {} : { chapter: entry.chapter }),
      ...(entry.noteText === null ? {} : { noteText: entry.noteText }),
    },
  });
  checkResponse(result);
  return entry;
}

async function audioUrl(entry: QueueEntry) {
  if (!entry.audio) throw new StepFailure("reject", "No audio to upload");
  const result = await api.POST("/sessions/{id}/audio-upload", {
    params: { path: { id: entry.id } },
    body: {
      durationSeconds: entry.audio.seconds,
      extension: entry.audio.extension,
    },
  });
  checkResponse(result);
  if (!result.data) throw new StepFailure("retry", "The upload failed");
  return withUploadUrl(entry, result.data.uploadUrl);
}

async function upload(entry: QueueEntry) {
  if (!entry.audio || !entry.uploadUrl) {
    throw new StepFailure("retry", "The upload failed");
  }
  const form = new FormData();
  form.set("cacheControl", "3600");
  form.set("", entry.audio.blob);
  const response = await fetch(entry.uploadUrl, { method: "PUT", body: form });
  if (!response.ok) {
    throw new StepFailure(classifyStatus(response.status), "Upload failed");
  }
  return entry;
}

async function processStep(entry: QueueEntry) {
  const result = await api.POST("/sessions/{id}/process", {
    params: { path: { id: entry.id } },
  });
  checkResponse(result, [409]);
  return entry;
}

const steps = {
  create,
  "audio-url": audioUrl,
  upload,
  process: processStep,
} as const;

async function runEntry(initial: QueueEntry) {
  let entry = initial;
  for (;;) {
    try {
      const done = await steps[entry.step](entry);
      const next = advance(done);
      if (next === null) {
        await removeEntry(entry.id);
        return;
      }
      entry = next;
      await putEntry(entry);
    } catch (error) {
      const failure =
        error instanceof StepFailure
          ? error
          : new StepFailure("retry", offlineMessage);
      await putEntry(fail(entry, failure.kind, failure.message, Date.now()));
      return;
    }
  }
}

let running = false;

export async function drainQueue() {
  if (running || !navigator.onLine) return;
  running = true;
  try {
    const due = dueEntries(await listEntries(), Date.now());
    for (const entry of due) {
      const current = await getEntry(entry.id);
      if (current) await runEntry(current);
    }
  } finally {
    running = false;
  }
}

export async function retryEntryNow(id: string) {
  const entry = await getEntry(id);
  if (entry) await putEntry(retryNow(entry, Date.now()));
  await drainQueue();
}

async function retryAllNow() {
  const now = Date.now();
  for (const entry of await listEntries()) {
    await putEntry(retryNow(entry, now));
  }
  await drainQueue();
}

const TICK_MS = 5000;

const onOnline = () => void retryAllNow();
const onChange = () => void drainQueue();

export function startQueueRunner() {
  window.addEventListener("online", onOnline);
  const unsubscribe = subscribeQueue(onChange);
  const timer = window.setInterval(() => void drainQueue(), TICK_MS);
  void drainQueue();
  return () => {
    window.removeEventListener("online", onOnline);
    unsubscribe();
    window.clearInterval(timer);
  };
}
