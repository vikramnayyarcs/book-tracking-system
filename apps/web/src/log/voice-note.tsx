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
      <div className="flex flex-wrap items-center gap-md">
        <Button variant="primary" onPress={stop}>
          Stop recording
        </Button>
        <p className="text-base text-ink">
          <span className="sr-only">Recording time </span>
          <span data-testid="recording-timer">
            {formatClock(state.seconds)}
          </span>{" "}
          of {cap}
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
    <div className="flex flex-col items-start gap-sm">
      <Button variant="primary" onPress={() => void start()}>
        Record
      </Button>
      <p className="text-sm text-ink-muted">
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
