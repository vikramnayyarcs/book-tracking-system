import { useState } from "react";
import { useAskVault } from "../api/ask-hooks.ts";
import { Button } from "../ui/button.tsx";
import { useOnline } from "../ui/online.ts";
import { TextField } from "../ui/text-field.tsx";
import { meta, noteCard, noteText } from "../ui/styles.ts";

const link =
  "text-accent underline outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const dateFormat = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeZone: "UTC",
});

export function AskPage() {
  const [text, setText] = useState("");
  const online = useOnline();
  const ask = useAskVault();
  const question = text.trim();

  return (
    <div className="flex max-w-page flex-col gap-lg">
      <h1 className="text-2xl font-medium">Ask your vault</h1>
      <form
        className="flex flex-col items-start gap-sm"
        onSubmit={(e) => {
          e.preventDefault();
          if (question !== "" && online && !ask.isPending) ask.mutate(question);
        }}
      >
        <TextField
          label="Your question"
          description="The answer uses only your own notes. Your question and the answer are not saved."
          value={text}
          onChange={setText}
          className="w-full"
        />
        <Button
          type="submit"
          variant="primary"
          isDisabled={!online || question === "" || ask.isPending}
        >
          Ask
        </Button>
        {!online ? (
          <p className="text-sm text-ink-muted">
            You are offline. Asking needs a connection.
          </p>
        ) : null}
      </form>
      <div aria-live="polite" className="flex flex-col gap-md">
        {ask.isIdle ? (
          <p className="text-base text-ink-muted">
            Ask about something you read, for example what you noted about a
            topic.
          </p>
        ) : null}
        {ask.isPending ? (
          <div
            aria-busy="true"
            data-testid="ask-loading"
            className="flex flex-col gap-sm"
          >
            {[0, 1].map((i) => (
              <div key={i} className="h-16 rounded-md bg-surface-sunken" />
            ))}
          </div>
        ) : null}
        {ask.isError ? (
          <div role="alert" className="flex flex-col items-start gap-sm">
            <p className="text-base text-danger">{ask.error.message}</p>
            <Button onPress={() => ask.mutate(question)}>Try again</Button>
          </div>
        ) : null}
        {ask.data && !ask.data.answered ? (
          <p className="text-base">
            Nothing to answer from. Your notes do not cover this question.
          </p>
        ) : null}
        {ask.data?.answered ? (
          <section aria-labelledby="answer-heading" className={noteCard}>
            <h2 id="answer-heading" className={meta}>
              Answer
            </h2>
            <p className={noteText}>{ask.data.answer}</p>
            <h3 className={`${meta} mt-sm`}>From your notes</h3>
            <ul className="flex flex-col gap-xs">
              {ask.data.citations.map((c) => (
                <li key={c.insightId} className="text-sm">
                  <a
                    href={
                      c.sessionId === null
                        ? `/books/${c.bookId}`
                        : `/books/${c.bookId}#session-${c.sessionId}`
                    }
                    className={link}
                  >
                    <span className="font-serif">{c.bookTitle}</span>
                    {c.sessionDate === null
                      ? ""
                      : `, session of ${dateFormat.format(new Date(c.sessionDate))}`}
                  </a>
                </li>
              ))}
            </ul>
            {ask.data.warn ? (
              <p className="text-sm text-ink-muted">
                You have used most of this month's questions.
              </p>
            ) : null}
          </section>
        ) : null}
      </div>
    </div>
  );
}
