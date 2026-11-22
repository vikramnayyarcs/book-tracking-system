import { meta, noteCard } from "../ui/styles.ts";
import { useState } from "react";
import { useSearch } from "../api/hooks.ts";
import { Button } from "../ui/button.tsx";
import { useOnline } from "../ui/online.ts";
import { TextField } from "../ui/text-field.tsx";
import { splitSnippet } from "./search-highlight.ts";

const kindLabel = {
  session: "Session note",
  insight: "Insight",
  quote: "Quote",
  review: "Review",
} as const;

const link =
  "text-accent underline outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

function Snippet({ snippet, serif }: { snippet: string; serif: boolean }) {
  return (
    <p className={`text-base ${serif ? "font-serif" : ""}`}>
      {splitSnippet(snippet).map((part, i) =>
        part.match ? (
          <mark
            key={i}
            className="rounded-sm bg-accent-subtle px-xs font-medium text-accent-subtle-ink underline"
          >
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </p>
  );
}

export function SearchPage() {
  const [text, setText] = useState("");
  const [submitted, setSubmitted] = useState("");
  const online = useOnline();
  const search = useSearch(submitted);

  return (
    <div className="flex max-w-page flex-col gap-lg">
      <h1 className="text-2xl font-medium">Search</h1>
      <form
        role="search"
        className="flex flex-col items-start gap-sm"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(text.trim());
        }}
      >
        <TextField
          label="Search your notes"
          value={text}
          onChange={setText}
          className="w-full"
        />
        <Button type="submit" variant="primary" isDisabled={!online}>
          Search
        </Button>
        {!online ? (
          <p className="text-sm text-ink-muted">
            You are offline. Search needs a connection.
          </p>
        ) : null}
      </form>
      <div aria-live="polite" className="flex flex-col gap-md">
        {submitted === "" ? (
          <p className="text-base text-ink-muted">
            Type a word or phrase from your insights, quotes, notes or reviews.
          </p>
        ) : null}
        {submitted !== "" && search.isPending ? (
          <div
            aria-busy="true"
            data-testid="search-loading"
            className="flex flex-col gap-sm"
          >
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 rounded-md bg-surface-sunken" />
            ))}
          </div>
        ) : null}
        {search.isError ? (
          <div role="alert" className="flex flex-col items-start gap-sm">
            <p className="text-base text-danger">{search.error.message}</p>
            <Button onPress={() => void search.refetch()}>Try again</Button>
          </div>
        ) : null}
        {search.data && search.data.items.length === 0 ? (
          <p className="text-base text-ink-muted">
            No matches. Try a shorter or different word.
          </p>
        ) : null}
        {search.data && search.data.items.length > 0 ? (
          <ul className="flex flex-col gap-md">
            {search.data.items.map((r) => (
              <li key={`${r.kind}-${r.id}`} className={noteCard}>
                <p className={meta}>{kindLabel[r.kind]}</p>
                <Snippet snippet={r.snippet} serif={r.kind === "quote"} />
                <p className="text-sm">
                  <a
                    href={
                      r.kind === "session"
                        ? `/books/${r.bookId}#session-${r.id}`
                        : `/books/${r.bookId}`
                    }
                    className={link}
                  >
                    <span className="font-serif">{r.bookTitle}</span>
                    {r.kind === "session" ? ", open session" : ""}
                  </a>
                </p>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
