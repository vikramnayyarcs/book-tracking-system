import { useNavigate, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { FileTrigger } from "react-aria-components";
import {
  useBookInsights,
  useBookSessions,
  useFinishBook,
} from "../api/book-hooks.ts";
import { useBook } from "../api/session-hooks.ts";
import { checkPhoto, parseRating } from "../books/book-logic.ts";
import { ReflectionQuestions } from "../books/reflections.tsx";
import { Button } from "../ui/button.tsx";
import { ChoiceGroup } from "../ui/choice-group.tsx";
import { useOnline } from "../ui/online.ts";
import { TextField } from "../ui/text-field.tsx";

const ratingChoices = [1, 2, 3, 4, 5].map((n) => ({
  id: String(n),
  label: String(n),
}));

const pad = (n: number) => String(n).padStart(2, "0");

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function FinishForm({ bookId }: { bookId: string }) {
  const navigate = useNavigate();
  const online = useOnline();
  const finish = useFinishBook(bookId);
  const sessions = useBookSessions(bookId);
  const insights = useBookInsights(bookId);
  const [rating, setRating] = useState("");
  const [review, setReview] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const hasNotes =
    (sessions.data?.items.some((s) => s.noteText) ?? false) ||
    (insights.data?.items.length ?? 0) > 0;

  const submit = () => {
    const parsed = parseRating(rating);
    finish.mutate(
      {
        body: {
          ...(parsed === null ? {} : { rating: parsed }),
          ...(review.trim() === "" ? {} : { review: review.trim() }),
          finishedOn: today(),
        },
        photo,
      },
      {
        onSuccess: () =>
          void navigate({ to: "/books/$bookId", params: { bookId } }),
      },
    );
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
        label="Rating, 1 to 5"
        choices={ratingChoices}
        value={rating}
        onChange={setRating}
      />
      <div className="flex flex-col items-start gap-sm">
        <p className="text-sm font-medium text-ink">Finish photo</p>
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
            {photo ? "Choose another photo" : "Add finish photo"}
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
      <TextField
        label="Your review"
        multiline
        rows={6}
        value={review}
        onChange={setReview}
      />
      <ReflectionQuestions
        bookId={bookId}
        stage="end"
        heading="Reflection questions"
        canAsk={hasNotes}
        cannotAskReason="Log a session first. The questions come from your own notes."
        askLabel="Ask me 3 questions"
      />
      {finish.isError ? (
        <p role="alert" className="text-sm text-danger">
          {finish.error.message}
        </p>
      ) : null}
      {!online ? (
        <p className="text-sm text-ink-muted">
          Offline. Finishing a book needs a connection.
        </p>
      ) : null}
      <Button
        type="submit"
        variant="primary"
        isDisabled={!online || finish.isPending}
      >
        {finish.isPending ? "Finishing" : "Finish book"}
      </Button>
    </form>
  );
}

export function FinishBookPage() {
  const { bookId } = useParams({ strict: false });
  const id = bookId ?? "";
  const book = useBook(id);

  return (
    <div className="flex max-w-narrow flex-col gap-lg">
      <div className="flex flex-col gap-xs">
        <h1 className="text-2xl font-medium">Finish book</h1>
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
      {book.isError ? (
        <div role="alert" className="flex flex-col items-start gap-sm">
          <p className="text-base text-danger">{book.error.message}</p>
          <Button onPress={() => void book.refetch()}>Try again</Button>
        </div>
      ) : (
        <FinishForm bookId={id} />
      )}
    </div>
  );
}
