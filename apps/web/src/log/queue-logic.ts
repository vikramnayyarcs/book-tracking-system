export type AudioExtension = "m4a" | "webm";

export type QueueStep = "create" | "audio-url" | "upload" | "process";

export interface QueueAudio {
  blob: Blob;
  seconds: number;
  extension: AudioExtension;
}

export interface QueueEntry {
  id: string;
  bookId: string;
  date: string;
  pageFrom: number | null;
  pageTo: number | null;
  chapter: string | null;
  noteText: string | null;
  audio: QueueAudio | null;
  step: QueueStep;
  uploadUrl: string | null;
  attempts: number;
  nextAttemptAt: number;
  lastError: string | null;
  rejected: boolean;
  createdAt: number;
}

export type NewEntry = Pick<
  QueueEntry,
  | "id"
  | "bookId"
  | "date"
  | "pageFrom"
  | "pageTo"
  | "chapter"
  | "noteText"
  | "audio"
>;

export const BASE_DELAY_MS = 2000;
export const MAX_DELAY_MS = 60000;

export function createEntry(input: NewEntry, now: number) {
  return {
    ...input,
    step: "create",
    uploadUrl: null,
    attempts: 0,
    nextAttemptAt: now,
    lastError: null,
    rejected: false,
    createdAt: now,
  } satisfies QueueEntry;
}

export function retryDelayMs(attempts: number) {
  return Math.min(BASE_DELAY_MS * 2 ** Math.max(attempts - 1, 0), MAX_DELAY_MS);
}

export function isDue(entry: QueueEntry, now: number) {
  return !entry.rejected && entry.nextAttemptAt <= now;
}

export function dueEntries(entries: readonly QueueEntry[], now: number) {
  return entries
    .filter((entry) => isDue(entry, now))
    .toSorted((a, b) => a.createdAt - b.createdAt);
}

export function nextStep(entry: QueueEntry) {
  switch (entry.step) {
    case "create":
      return entry.audio ? "audio-url" : "process";
    case "audio-url":
      return "upload";
    case "upload":
      return "process";
    case "process":
      return null;
  }
}

export function advance(entry: QueueEntry) {
  const step = nextStep(entry);
  if (step === null) return null;
  return { ...entry, step, attempts: 0, lastError: null } satisfies QueueEntry;
}

export function withUploadUrl(entry: QueueEntry, uploadUrl: string) {
  return { ...entry, uploadUrl } satisfies QueueEntry;
}

export type FailureKind = "retry" | "reject";

export function classifyStatus(status: number) {
  if (status === 408 || status === 425 || status === 429) {
    return "retry" satisfies FailureKind;
  }
  if (status >= 400 && status < 500) return "reject" satisfies FailureKind;
  return "retry" satisfies FailureKind;
}

export function fail(
  entry: QueueEntry,
  kind: FailureKind,
  message: string,
  now: number,
) {
  const attempts = entry.attempts + 1;
  const restartUpload = entry.step === "upload";
  return {
    ...entry,
    step: restartUpload ? "audio-url" : entry.step,
    uploadUrl: restartUpload ? null : entry.uploadUrl,
    attempts,
    lastError: message,
    rejected: kind === "reject",
    nextAttemptAt: now + retryDelayMs(attempts),
  } satisfies QueueEntry;
}

export function retryNow(entry: QueueEntry, now: number) {
  return { ...entry, rejected: false, nextAttemptAt: now } satisfies QueueEntry;
}

export function waitingSummary(entries: readonly QueueEntry[]) {
  const waiting = entries.filter((entry) => !entry.rejected).length;
  return { waiting, rejected: entries.length - waiting };
}
