import { useCallback, useEffect, useRef, useState } from "react";
import {
  clampSeconds,
  elapsedSeconds,
  isAtCap,
  pickAudioFormat,
  type AudioFormat,
} from "./form-logic.ts";
import type { QueueAudio } from "./queue-logic.ts";

export type RecorderState =
  | { phase: "idle" }
  | { phase: "recording"; seconds: number }
  | { phase: "recorded"; audio: QueueAudio }
  | { phase: "denied" }
  | { phase: "unsupported" };

const TICK_MS = 250;

function detectFormat() {
  if (
    typeof MediaRecorder === "undefined" ||
    !navigator.mediaDevices?.getUserMedia
  ) {
    return null;
  }
  return pickAudioFormat((type) => MediaRecorder.isTypeSupported(type));
}

export function useRecorder() {
  const [state, setState] = useState<RecorderState>(() =>
    detectFormat() ? { phase: "idle" } : { phase: "unsupported" },
  );
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<number | null>(null);
  const startedAt = useRef(0);

  const release = useCallback(() => {
    if (timer.current !== null) window.clearInterval(timer.current);
    timer.current = null;
    for (const track of stream.current?.getTracks() ?? []) track.stop();
    stream.current = null;
  }, []);

  const stop = useCallback(() => {
    if (recorder.current?.state === "recording") recorder.current.stop();
  }, []);

  const start = useCallback(async () => {
    const format: AudioFormat | null = detectFormat();
    if (!format) {
      setState({ phase: "unsupported" });
      return;
    }
    let media: MediaStream;
    try {
      media = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setState({ phase: "denied" });
      return;
    }
    stream.current = media;
    const chunks: Blob[] = [];
    const next = new MediaRecorder(media, { mimeType: format.mimeType });
    recorder.current = next;
    next.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    });
    next.addEventListener("stop", () => {
      const seconds = clampSeconds((Date.now() - startedAt.current) / 1000);
      release();
      setState({
        phase: "recorded",
        audio: {
          blob: new Blob(chunks, { type: format.mimeType }),
          seconds,
          extension: format.extension,
        },
      });
    });
    startedAt.current = Date.now();
    next.start();
    setState({ phase: "recording", seconds: 0 });
    timer.current = window.setInterval(() => {
      const seconds = elapsedSeconds(startedAt.current, Date.now());
      setState({ phase: "recording", seconds });
      if (isAtCap(seconds)) stop();
    }, TICK_MS);
  }, [release, stop]);

  const discard = useCallback(() => {
    setState({ phase: "idle" });
  }, []);

  useEffect(
    () => () => {
      if (recorder.current?.state === "recording") {
        recorder.current.stop();
      }
      release();
    },
    [release],
  );

  return { state, start, stop, discard };
}
