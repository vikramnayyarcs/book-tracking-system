import { useParams } from "@tanstack/react-router";
import { useState } from "react";
import { useBook } from "../api/session-hooks.ts";
import {
  hasNote,
  parseLocation,
  type LocationMode,
} from "../log/form-logic.ts";
import { createEntry } from "../log/queue-logic.ts";
import { drainQueue } from "../log/queue-runner.ts";
import { putEntry } from "../log/queue-store.ts";
import { ProcessedSession, WaitingToUpload } from "../log/session-result.tsx";
import { useQueueEntries } from "../log/use-queue.ts";
import { useRecorder } from "../log/use-recorder.ts";
import { VoiceNote } from "../log/voice-note.tsx";
import { Button } from "../ui/button.tsx";
import { ChoiceGroup } from "../ui/choice-group.tsx";
import { TextField } from "../ui/text-field.tsx";

const pad = (n: number) => String(n).padStart(2, "0");

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const locationChoices = [
  { id: "pages", label: "Pages" },
  { id: "chapter", label: "Chapter" },
];

const noteChoices = [
  { id: "voice", label: "Voice note" },
  { id: "typed", label: "Type a note" },
];

function LogForm({
  bookId,
  onSaved,
}: {
  bookId: string;
  onSaved: (id: string) => void;
}) {
  const recorder = useRecorder();
  const recorderUnavailable = recorder.state.phase === "unsupported";
  const [date, setDate] = useState(today);
  const [mode, setMode] = useState<LocationMode>("pages");
  const [pageFrom, setPageFrom] = useState("");
  const [pageTo, setPageTo] = useState("");
  const [chapter, setChapter] = useState("");
  const [noteMode, setNoteMode] = useState("voice");
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const useVoice = noteMode === "voice" && !recorderUnavailable;
  const audio =
    recorder.state.phase === "recorded" ? recorder.state.audio : null;

  const submit = async () => {
    const location = parseLocation({ mode, pageFrom, pageTo, chapter });
    if (!location.ok) {
      setError(location.error);
      return;
    }
    if (date === "") {
      setError("Choose the date.");
      return;
    }
    const voiceAudio = useVoice ? audio : null;
    if (!hasNote(useVoice ? "" : typed, voiceAudio !== null)) {
      setError(
        useVoice
          ? "Record a voice note, or switch to typing."
          : "Write a note, or switch to a voice note.",
      );
      return;
    }
    setError(null);
    setSaving(true);
    const id = crypto.randomUUID();
    try {
      await putEntry(
        createEntry(
          {
            id,
            bookId,
            date,
            pageFrom: location.pageFrom,
            pageTo: location.pageTo,
            chapter: location.chapter,
            noteText: voiceAudio ? null : typed.trim(),
            audio: voiceAudio,
          },
          Date.now(),
        ),
      );
    } catch {
      setError("This device could not save the session. Try again.");
      setSaving(false);
      return;
    }
    void drainQueue();
    onSaved(id);
  };

  return (
    <form
      className="flex flex-col gap-lg"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <TextField label="Date" type="date" value={date} onChange={setDate} />
      <ChoiceGroup
        label="What did you read?"
        choices={locationChoices}
        value={mode}
        onChange={(id) => setMode(id as LocationMode)}
      />
      {mode === "pages" ? (
        <div className="flex gap-sm">
          <TextField
            label="From page"
            inputMode="numeric"
            value={pageFrom}
            onChange={setPageFrom}
            className="flex-1"
          />
          <TextField
            label="To page"
            inputMode="numeric"
            value={pageTo}
            onChange={setPageTo}
            className="flex-1"
          />
        </div>
      ) : (
        <TextField label="Chapter" value={chapter} onChange={setChapter} />
      )}
      {recorderUnavailable ? null : (
        <ChoiceGroup
          label="Your note"
          choices={noteChoices}
          value={noteMode}
          onChange={setNoteMode}
        />
      )}
      {useVoice ? (
        <VoiceNote recorder={recorder} />
      ) : (
        <TextField
          label={recorderUnavailable ? "Your note" : "Write your note"}
          multiline
          rows={6}
          value={typed}
          onChange={setTyped}
          description={
            recorderUnavailable
              ? "This browser cannot record audio, so type your note."
              : undefined
          }
        />
      )}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <Button
        type="submit"
        variant="primary"
        isDisabled={saving || recorder.state.phase === "recording"}
      >
        Save session
      </Button>
    </form>
  );
}

function Tracker({ id, onAnother }: { id: string; onAnother: () => void }) {
  const entries = useQueueEntries();
  if (entries === null) {
    return (
      <div
        aria-busy="true"
        className="h-24 rounded-md bg-surface-sunken"
        data-testid="queue-loading"
      />
    );
  }
  const entry = entries.find((candidate) => candidate.id === id);
  return (
    <div className="flex flex-col gap-lg">
      {entry ? (
        <WaitingToUpload entry={entry} />
      ) : (
        <ProcessedSession sessionId={id} />
      )}
      <div>
        <Button onPress={onAnother}>Log another session</Button>
      </div>
    </div>
  );
}

export function LogSessionPage() {
  const { bookId } = useParams({ strict: false });
  const id = bookId ?? "";
  const book = useBook(id);
  const [trackedId, setTrackedId] = useState<string | null>(null);

  return (
    <div className="flex max-w-narrow flex-col gap-lg">
      <div className="flex flex-col gap-xs">
        <h1 className="text-2xl font-medium">Log session</h1>
        {book.isPending ? (
          <div
            aria-busy="true"
            data-testid="book-loading"
            className="h-6 w-48 rounded-sm bg-surface-sunken"
          />
        ) : null}
        {book.data ? (
          <p className="font-serif text-lg text-ink-muted">{book.data.title}</p>
        ) : null}
      </div>
      {trackedId === null ? (
        <LogForm bookId={id} onSaved={setTrackedId} />
      ) : null}
      {trackedId !== null ? (
        <Tracker id={trackedId} onAnother={() => setTrackedId(null)} />
      ) : null}
    </div>
  );
}
