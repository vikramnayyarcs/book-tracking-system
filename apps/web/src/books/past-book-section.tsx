import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { FileTrigger } from "react-aria-components";
import { useAddPastBook } from "../api/past-book-hooks.ts";
import { hasNote } from "../log/form-logic.ts";
import { createEntry } from "../log/queue-logic.ts";
import { drainQueue } from "../log/queue-runner.ts";
import { putEntry } from "../log/queue-store.ts";
import { ProcessedSession, WaitingToUpload } from "../log/session-result.tsx";
import { useQueueEntries } from "../log/use-queue.ts";
import { useRecorder } from "../log/use-recorder.ts";
import { VoiceNote } from "../log/voice-note.tsx";
import { Button } from "../ui/button.tsx";
import { ChoiceGroup } from "../ui/choice-group.tsx";
import { useOnline } from "../ui/online.ts";
import { TextField } from "../ui/text-field.tsx";
import type { Draft } from "./add-book-logic.ts";
import { checkPhoto } from "./book-logic.ts";
import {
  describeFinish,
  type FinishPrecision,
  parsePastFinish,
  pastBookBody,
  pastBookError,
  pastRating,
} from "./past-book-logic.ts";
import { ReflectionQuestions } from "./reflections.tsx";

const precisionChoices = [
  { id: "month", label: "Month and year" },
  { id: "year", label: "Year only" },
];

const ratingChoices = [1, 2, 3, 4, 5].map((n) => ({
  id: String(n),
  label: String(n),
}));

const noteChoices = [
  { id: "voice", label: "Voice note" },
  { id: "typed", label: "Type a note" },
];

const link =
  "inline-flex min-h-11 items-center rounded-md border border-border-strong bg-surface px-md text-base text-ink outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

interface Added {
  bookId: string;
  title: string;
  finished: string;
  sessionId: string | null;
  noteSaveFailed: boolean;
}

function PastResult({ added }: { added: Added }) {
  const entries = useQueueEntries();
  const entry =
    added.sessionId === null
      ? undefined
      : entries?.find((candidate) => candidate.id === added.sessionId);

  return (
    <div className="flex flex-col gap-xl">
      <section aria-labelledby="past-added-h" className="flex flex-col gap-xs">
        <h2 id="past-added-h" className="text-lg font-medium">
          Book added
        </h2>
        <p role="status" className="text-base text-ink">
          <span className="font-serif">{added.title}</span>, finished{" "}
          {added.finished}.
        </p>
      </section>
      {added.noteSaveFailed ? (
        <p role="alert" className="text-base text-danger">
          The book is on your shelf, but this device could not save your note.
          Add the note from the book page.
        </p>
      ) : null}
      {added.sessionId === null ? null : entries === null ? (
        <div
          aria-busy="true"
          data-testid="queue-loading"
          className="h-24 rounded-md bg-surface-sunken"
        />
      ) : entry ? (
        <WaitingToUpload entry={entry} />
      ) : (
        <ProcessedSession sessionId={added.sessionId} />
      )}
      <ReflectionQuestions
        bookId={added.bookId}
        stage="recall"
        heading="Recall prompts"
        canAsk
        cannotAskReason=""
        askLabel="Give me 3 recall prompts"
      />
      <div>
        <Link
          to="/books/$bookId"
          params={{ bookId: added.bookId }}
          className={link}
        >
          Go to the book
        </Link>
      </div>
    </div>
  );
}

export function PastBookSection({
  draft,
  onCancel,
}: {
  draft: Draft;
  onCancel: () => void;
}) {
  const online = useOnline();
  const add = useAddPastBook();
  const recorder = useRecorder();
  const recorderUnavailable = recorder.state.phase === "unsupported";
  const [precision, setPrecision] = useState<FinishPrecision>("month");
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const [rating, setRating] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [noteMode, setNoteMode] = useState("voice");
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<Added | null>(null);

  const useVoice = noteMode === "voice" && !recorderUnavailable;
  const audio =
    recorder.state.phase === "recorded" ? recorder.state.audio : null;

  if (added) return <PastResult added={added} />;

  const submit = () => {
    const now = new Date();
    const finish = { precision, year, month };
    const problem = pastBookError(draft, finish, now);
    setError(problem);
    if (problem) return;
    const parsed = parsePastFinish(finish, now);
    if (!parsed.ok) return;
    const voiceAudio = useVoice ? audio : null;
    const noteText = useVoice ? "" : typed.trim();
    add.mutate(
      {
        body: pastBookBody(draft, parsed),
        rating: pastRating(rating),
        photo,
      },
      {
        onSuccess: (book) => {
          void saveNote(
            book.id,
            book.title,
            parsed.finishedOn,
            parsed.precision,
          );
        },
      },
    );

    async function saveNote(
      bookId: string,
      title: string,
      finishedOn: string,
      finishedPrecision: FinishPrecision,
    ) {
      const finished = describeFinish(finishedOn, finishedPrecision);
      if (!hasNote(noteText, voiceAudio !== null)) {
        setAdded({
          bookId,
          title,
          finished,
          sessionId: null,
          noteSaveFailed: false,
        });
        return;
      }
      const sessionId = crypto.randomUUID();
      try {
        await putEntry(
          createEntry(
            {
              id: sessionId,
              bookId,
              date: finishedOn,
              pageFrom: null,
              pageTo: null,
              chapter: null,
              noteText: voiceAudio ? null : noteText,
              audio: voiceAudio,
            },
            Date.now(),
          ),
        );
      } catch {
        setAdded({
          bookId,
          title,
          finished,
          sessionId: null,
          noteSaveFailed: true,
        });
        return;
      }
      void drainQueue();
      setAdded({ bookId, title, finished, sessionId, noteSaveFailed: false });
    }
  };

  return (
    <form
      className="flex flex-col gap-lg"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <ChoiceGroup
        label="How exact is the finish date?"
        choices={precisionChoices}
        value={precision}
        onChange={(id) => setPrecision(id as FinishPrecision)}
      />
      <div className="flex gap-sm">
        {precision === "month" ? (
          <TextField
            label="Month, 1 to 12"
            inputMode="numeric"
            value={month}
            onChange={setMonth}
            className="flex-1"
          />
        ) : null}
        <TextField
          label="Year finished"
          inputMode="numeric"
          value={year}
          onChange={setYear}
          className="flex-1"
        />
      </div>
      <ChoiceGroup
        label="Rating, 1 to 5"
        choices={ratingChoices}
        value={rating}
        onChange={setRating}
      />
      <div className="flex flex-col items-start gap-sm">
        <p className="text-sm font-medium text-ink">Photo, if you have one</p>
        <FileTrigger
          acceptedFileTypes={["image/jpeg", "image/png", "image/webp"]}
          onSelect={(files) => {
            const file = files?.[0] ?? null;
            if (!file) return;
            const problem = checkPhoto(file);
            setPhotoError(problem);
            setPhoto(problem === null ? file : null);
          }}
        >
          <Button isDisabled={!online}>
            {photo ? "Choose another photo" : "Add a photo"}
          </Button>
        </FileTrigger>
        {photo ? (
          <div className="flex flex-wrap items-center gap-sm">
            <p role="status" className="text-sm text-ink">
              Photo ready: {photo.name}
            </p>
            <Button onPress={() => setPhoto(null)}>Remove photo</Button>
          </div>
        ) : null}
        {photoError ? (
          <p role="alert" className="text-sm text-danger">
            {photoError}
          </p>
        ) : null}
      </div>
      <section aria-labelledby="remember-h" className="flex flex-col gap-sm">
        <h2 id="remember-h" className="text-lg font-medium">
          What I remember
        </h2>
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
            label="Write what you remember"
            multiline
            rows={6}
            value={typed}
            onChange={setTyped}
            description={
              recorderUnavailable
                ? "This browser cannot record audio, so type your note."
                : "Optional. The recall prompts after you add the book can help."
            }
          />
        )}
      </section>
      {error ? (
        <p role="alert" className="text-base text-danger">
          {error}
        </p>
      ) : null}
      {add.isError ? (
        <p role="alert" className="text-base text-danger">
          {add.error.message}
        </p>
      ) : null}
      {!online ? (
        <p className="text-sm text-ink-muted">
          Offline. Adding a book needs a connection.
        </p>
      ) : null}
      <div className="flex gap-sm">
        <Button
          type="submit"
          variant="primary"
          isDisabled={
            !online || add.isPending || recorder.state.phase === "recording"
          }
        >
          {add.isPending ? "Adding" : "Add past book"}
        </Button>
        <Button onPress={onCancel}>Start again</Button>
      </div>
    </form>
  );
}
