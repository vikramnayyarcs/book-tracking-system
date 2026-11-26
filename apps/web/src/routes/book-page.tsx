import { useEffect, useState } from "react";
import { meta, noteCard, noteText, quoteText } from "../ui/styles.ts";
import type { components } from "@book-tracking-system/api-contract/types";
import { Link, useParams } from "@tanstack/react-router";
import {
  useBookInsights,
  useBookReflections,
  useBookReview,
  useBookSessions,
  useRegenerateSummary,
} from "../api/book-hooks.ts";
import { useMe } from "../api/hooks.ts";
import { useBook } from "../api/session-hooks.ts";
import { useOnline } from "../ui/online.ts";
import {
  reflectionsFor,
  sessionLocation,
  splitInsights,
} from "../books/book-logic.ts";
import { ReflectionQuestions } from "../books/reflections.tsx";
import { Button } from "../ui/button.tsx";

type Session = components["schemas"]["Session"];
type Insight = components["schemas"]["Insight"];

const focus =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const primaryLink = `inline-flex min-h-11 items-center rounded-md bg-accent px-md text-base font-medium text-accent-ink ${focus}`;
const secondaryLink = `inline-flex min-h-11 items-center rounded-md border border-border-strong bg-surface px-md text-base text-ink ${focus}`;

const SUMMARY_WAIT_MS = 30_000;

const statusLabel = {
  reading: "Reading",
  finished: "Finished",
  abandoned: "Abandoned",
} as const;

function Skeleton({ testId }: { testId: string }) {
  return (
    <div
      aria-busy="true"
      data-testid={testId}
      className="h-24 rounded-md bg-surface-sunken"
    />
  );
}

function LoadError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div role="alert" className="flex flex-col items-start gap-sm">
      <p className="text-base text-danger">{message}</p>
      <Button onPress={onRetry}>Try again</Button>
    </div>
  );
}

function SessionItem({ session }: { session: Session }) {
  return (
    <li className={noteCard}>
      <p className={meta}>
        {session.date}, {sessionLocation(session)}
      </p>
      {session.noteText ? (
        <p className={noteText}>{session.noteText}</p>
      ) : (
        <p className="text-base text-ink-muted">
          {session.status === "failed"
            ? "Processing failed. Open the session to try again."
            : "The note is still being processed."}
        </p>
      )}
    </li>
  );
}

function Sessions({ bookId }: { bookId: string }) {
  const sessions = useBookSessions(bookId);
  return (
    <section
      aria-labelledby="sessions-heading"
      className="flex flex-col gap-sm"
    >
      <h2 id="sessions-heading" className="text-lg font-medium">
        Sessions
      </h2>
      {sessions.isPending ? <Skeleton testId="sessions-loading" /> : null}
      {sessions.isError ? (
        <LoadError
          message={sessions.error.message}
          onRetry={() => void sessions.refetch()}
        />
      ) : null}
      {sessions.data && sessions.data.items.length === 0 ? (
        <p className="text-base text-ink-muted">
          No sessions yet. Log one after your next read.
        </p>
      ) : null}
      {sessions.data && sessions.data.items.length > 0 ? (
        <ul className="flex flex-col gap-sm">
          {sessions.data.items.map((session) => (
            <SessionItem key={session.id} session={session} />
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function InsightItem({ insight }: { insight: Insight }) {
  const isQuote = insight.kind === "quote";
  return (
    <li className={noteCard}>
      <p className={isQuote ? quoteText : noteText}>{insight.text}</p>
      <p className={meta}>
        {insight.page ? `Page ${insight.page}` : "No page noted"}
        {insight.pinned ? ", pinned" : ""}
      </p>
    </li>
  );
}

function InsightsAndQuotes({ bookId }: { bookId: string }) {
  const insights = useBookInsights(bookId);
  const split = insights.data ? splitInsights(insights.data.items) : null;
  return (
    <>
      <section
        aria-labelledby="insights-heading"
        className="flex flex-col gap-sm"
      >
        <h2 id="insights-heading" className="text-lg font-medium">
          Insights
        </h2>
        {insights.isPending ? <Skeleton testId="insights-loading" /> : null}
        {insights.isError ? (
          <LoadError
            message={insights.error.message}
            onRetry={() => void insights.refetch()}
          />
        ) : null}
        {split && split.insights.length === 0 ? (
          <p className="text-base text-ink-muted">
            No insights yet. They appear after a session is processed.
          </p>
        ) : null}
        {split && split.insights.length > 0 ? (
          <ul className="flex flex-col gap-sm">
            {split.insights.map((insight) => (
              <InsightItem key={insight.id} insight={insight} />
            ))}
          </ul>
        ) : null}
      </section>
      <section
        aria-labelledby="quotes-heading"
        className="flex flex-col gap-sm"
      >
        <h2 id="quotes-heading" className="text-lg font-medium">
          Quotes
        </h2>
        {insights.isPending ? <Skeleton testId="quotes-loading" /> : null}
        {split && split.quotes.length === 0 ? (
          <p className="text-base text-ink-muted">No quotes saved yet.</p>
        ) : null}
        {split && split.quotes.length > 0 ? (
          <ul className="flex flex-col gap-sm">
            {split.quotes.map((insight) => (
              <InsightItem key={insight.id} insight={insight} />
            ))}
          </ul>
        ) : null}
      </section>
    </>
  );
}

function Summary({ bookId, hasNotes }: { bookId: string; hasNotes: boolean }) {
  const me = useMe();
  const plus = me.data?.tier === "plus";
  const review = useBookReview(bookId, true, plus && hasNotes);
  const write = useRegenerateSummary(bookId);
  const online = useOnline();
  const [gaveUp, setGaveUp] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setGaveUp(true), SUMMARY_WAIT_MS);
    return () => clearTimeout(timer);
  }, []);
  if (!me.data || !review.data) return null;
  const summary = review.data.summary;
  const waiting =
    plus && hasNotes && summary === null && !write.isPending && !gaveUp;
  return (
    <section aria-labelledby="summary-heading" className="flex flex-col gap-sm">
      <h2 id="summary-heading" className="text-lg font-medium">
        Your summary
      </h2>
      {!plus ? (
        <p className="text-base text-ink-muted">
          Book summaries are part of the Plus plan.
        </p>
      ) : null}
      {plus && !hasNotes ? (
        <p className="text-base text-ink-muted">
          Nothing to summarise yet. The summary comes from your own notes.
        </p>
      ) : null}
      {summary !== null ? <p className={noteText}>{summary}</p> : null}
      {waiting ? (
        <p role="status" className="text-base text-ink-muted">
          Writing your summary.
        </p>
      ) : null}
      {plus && hasNotes ? (
        <div className="flex flex-col items-start gap-sm">
          <Button
            isDisabled={!online || write.isPending}
            onPress={() => write.mutate()}
          >
            {write.isPending
              ? "Writing"
              : summary === null
                ? "Write summary"
                : "Write again"}
          </Button>
          {!online ? (
            <p className="text-sm text-ink-muted">
              Offline. The summary needs a connection.
            </p>
          ) : null}
          {write.isError ? (
            <p role="alert" className="text-sm text-danger">
              {write.error.message}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function Review({ bookId }: { bookId: string }) {
  const review = useBookReview(bookId, true);
  if (!review.data) return null;
  const { rating, text } = review.data;
  if (rating === null && !text) return null;
  return (
    <section aria-labelledby="review-heading" className="flex flex-col gap-sm">
      <h2 id="review-heading" className="text-lg font-medium">
        Your review
      </h2>
      {rating !== null ? (
        <p className="text-base">Rating: {rating} out of 5</p>
      ) : null}
      {text ? <p className="text-base">{text}</p> : null}
    </section>
  );
}

export function BookPage() {
  const { bookId } = useParams({ strict: false });
  const id = bookId ?? "";
  const book = useBook(id);
  const sessions = useBookSessions(id);
  const insights = useBookInsights(id);
  const reflections = useBookReflections(id);

  if (book.isPending) {
    return (
      <div className="flex max-w-narrow flex-col gap-lg">
        <h1 className="text-2xl font-medium">Book</h1>
        <Skeleton testId="book-loading" />
      </div>
    );
  }
  if (book.isError) {
    return (
      <div className="flex max-w-narrow flex-col gap-lg">
        <h1 className="text-2xl font-medium">Book</h1>
        <LoadError
          message={book.error.message}
          onRetry={() => void book.refetch()}
        />
      </div>
    );
  }

  const data = book.data;
  const hasNotes =
    (sessions.data?.items.some((s) => s.noteText) ?? false) ||
    (insights.data?.items.length ?? 0) > 0;
  const hasMid = reflections.data
    ? reflectionsFor(reflections.data.items, "mid").length > 0
    : false;
  const hasEnd = reflections.data
    ? reflectionsFor(reflections.data.items, "end").length > 0
    : false;

  return (
    <div className="flex max-w-narrow flex-col gap-xl">
      <div className="flex flex-col gap-xs">
        <h1 className="font-serif text-2xl font-medium">{data.title}</h1>
        {data.author ? (
          <p className="text-base text-ink-muted">{data.author}</p>
        ) : null}
        <p className="text-sm text-ink-muted">{statusLabel[data.status]}</p>
      </div>
      {data.status === "reading" ? (
        <div className="flex flex-wrap gap-sm">
          <Link
            to="/books/$bookId/log"
            params={{ bookId: id }}
            className={primaryLink}
          >
            Log session
          </Link>
          <Link
            to="/books/$bookId/finish"
            params={{ bookId: id }}
            className={secondaryLink}
          >
            Finish book
          </Link>
        </div>
      ) : null}
      {data.status === "finished" ? <Review bookId={id} /> : null}
      {data.status === "finished" ? (
        <Summary bookId={id} hasNotes={hasNotes} />
      ) : null}
      {data.status === "reading" || hasMid ? (
        <ReflectionQuestions
          bookId={id}
          stage="mid"
          heading="Questions to think about"
          canAsk={hasNotes}
          cannotAskReason="Log a session first. The questions come from your own notes."
          askLabel="Ask me 3 questions"
        />
      ) : null}
      {hasEnd ? (
        <ReflectionQuestions
          bookId={id}
          stage="end"
          heading="Questions from the end of the book"
          canAsk={hasNotes}
          cannotAskReason="Log a session first. The questions come from your own notes."
          askLabel="Ask me 3 questions"
        />
      ) : null}
      <Sessions bookId={id} />
      <InsightsAndQuotes bookId={id} />
    </div>
  );
}
