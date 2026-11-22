import type { AudioExtension } from "./queue-logic.ts";

export const MAX_RECORDING_SECONDS = 600;

export type LocationMode = "pages" | "chapter";

export interface LocationInput {
  mode: LocationMode;
  pageFrom: string;
  pageTo: string;
  chapter: string;
}

export type LocationResult =
  | {
      ok: true;
      pageFrom: number | null;
      pageTo: number | null;
      chapter: string | null;
    }
  | { ok: false; error: string };

function parsePage(text: string) {
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return value >= 1 ? value : null;
}

export function parseLocation(input: LocationInput) {
  if (input.mode === "chapter") {
    const chapter = input.chapter.trim();
    if (chapter === "")
      return {
        ok: false,
        error: "Enter the chapter.",
      } satisfies LocationResult;
    if (chapter.length > 300) {
      return {
        ok: false,
        error: "Keep the chapter under 300 characters.",
      } satisfies LocationResult;
    }
    return {
      ok: true,
      pageFrom: null,
      pageTo: null,
      chapter,
    } satisfies LocationResult;
  }
  const from = parsePage(input.pageFrom);
  const to = parsePage(input.pageTo);
  if (from === null || to === null) {
    return {
      ok: false,
      error: "Enter the first and last page as numbers.",
    } satisfies LocationResult;
  }
  if (to < from) {
    return {
      ok: false,
      error: "The last page must not be before the first page.",
    } satisfies LocationResult;
  }
  return {
    ok: true,
    pageFrom: from,
    pageTo: to,
    chapter: null,
  } satisfies LocationResult;
}

export function clampSeconds(seconds: number) {
  return Math.min(Math.max(Math.floor(seconds), 1), MAX_RECORDING_SECONDS);
}

export function elapsedSeconds(startedAt: number, now: number) {
  return Math.min(
    Math.max(Math.floor((now - startedAt) / 1000), 0),
    MAX_RECORDING_SECONDS,
  );
}

export function isAtCap(seconds: number) {
  return seconds >= MAX_RECORDING_SECONDS;
}

export function formatClock(seconds: number) {
  const whole = Math.max(Math.floor(seconds), 0);
  const minutes = Math.floor(whole / 60);
  const rest = String(whole % 60).padStart(2, "0");
  return `${minutes}:${rest}`;
}

export interface AudioFormat {
  mimeType: string;
  extension: AudioExtension;
}

const candidates: AudioFormat[] = [
  { mimeType: "audio/mp4", extension: "m4a" },
  { mimeType: "audio/webm;codecs=opus", extension: "webm" },
  { mimeType: "audio/webm", extension: "webm" },
];

export function pickAudioFormat(isSupported: (mimeType: string) => boolean) {
  return candidates.find((format) => isSupported(format.mimeType)) ?? null;
}

export function hasNote(typed: string, hasAudio: boolean) {
  return hasAudio || typed.trim() !== "";
}
