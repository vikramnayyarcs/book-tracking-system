import { meta } from "../ui/styles.ts";
import { Button } from "../ui/button.tsx";
import { formatClock, MAX_RECORDING_SECONDS } from "./form-logic.ts";
import type { useRecorder } from "./use-recorder.ts";

export function VoiceNote({
  recorder,
}: {
  recorder: ReturnType<typeof useRecorder>;
}) {
  const { state, start, stop, discard } = recorder;
  const cap = formatClock(MAX_RECORDING_SECONDS);

  if (state.phase === "recording") {
    return (
      <div className="flex flex-col items-center gap-md">
        <Button variant="record" onPress={stop}>
          Stop recording
        </Button>
        <p className="font-mono text-lg text-ink">
          <span className="sr-only">Recording time </span>
          <span data-testid="recording-timer">
            {formatClock(state.seconds)}
          </span>{" "}
          <span className={meta}>of {cap}</span>
        </p>
      </div>
    );
  }
  if (state.phase === "recorded") {
    return (
      <div className="flex flex-col items-start gap-sm">
        <p role="status" className="text-base text-ink">
          Voice note recorded, {formatClock(state.audio.seconds)}.
        </p>
        <Button onPress={discard}>Discard and record again</Button>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-sm">
      <Button variant="record" onPress={() => void start()}>
        Record
      </Button>
      <p className="font-mono text-lg text-ink-muted">{formatClock(0)}</p>
      <p className="text-center text-sm text-ink-muted">
        The browser asks for the microphone when you tap Record. A note can be
        up to {cap} long.
      </p>
      {state.phase === "denied" ? (
        <p role="alert" className="text-sm text-danger">
          The microphone is blocked. Allow it in the browser settings, or type
          your note.
        </p>
      ) : null}
    </div>
  );
}
