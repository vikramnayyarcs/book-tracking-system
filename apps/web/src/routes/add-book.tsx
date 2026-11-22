import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  useCreateBook,
  useLookupIsbn,
  useSearchLookupBooks,
} from "../api/add-book-hooks.ts";
import {
  bookBody,
  type Draft,
  draftError,
  draftFrom,
  emptyDraft,
  parseIsbn,
} from "../books/add-book-logic.ts";
import { BarcodeScanner } from "../books/barcode-scanner.tsx";
import { PastBookSection } from "../books/past-book-section.tsx";
import { Button } from "../ui/button.tsx";
import { ChoiceGroup } from "../ui/choice-group.tsx";
import { useOnline } from "../ui/online.ts";
import { TextField } from "../ui/text-field.tsx";

function Cover({ url, title }: { url: string; title: string }) {
  if (url) {
    return (
      <img
        src={url}
        alt=""
        className="aspect-2/3 w-24 rounded-md border border-border object-cover"
      />
    );
  }
  return (
    <div
      aria-hidden="true"
      className="flex aspect-2/3 w-24 items-center justify-center rounded-md border border-border bg-accent-subtle p-sm text-center font-serif text-sm text-accent-subtle-ink"
    >
      {title}
    </div>
  );
}

const whenChoices = [
  { id: "now", label: "Reading it now" },
  { id: "past", label: "Finished before" },
];

function ConfirmBook({
  initial,
  online,
  onCancel,
}: {
  initial: Draft;
  online: boolean;
  onCancel: () => void;
}) {
  const navigate = useNavigate();
  const create = useCreateBook();
  const [draft, setDraft] = useState(initial);
  const [when, setWhen] = useState("now");
  const [shownError, setShownError] = useState<string | null>(null);
  const set = (key: keyof Draft) => (value: string) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const submit = () => {
    const problem = draftError(draft);
    setShownError(problem);
    if (problem) return;
    create.mutate(bookBody(draft), {
      onSuccess: (book) =>
        void navigate({ to: "/books/$bookId", params: { bookId: book.id } }),
    });
  };

  return (
    <section aria-labelledby="confirm-h" className="flex flex-col gap-md">
      <h2 id="confirm-h" className="text-lg font-medium">
        Check the details
      </h2>
      <div className="flex gap-md">
        <Cover url={draft.coverUrl} title={draft.title || "No title"} />
        <div className="flex flex-1 flex-col gap-sm">
          <TextField
            label="Title"
            value={draft.title}
            onChange={set("title")}
          />
          <TextField
            label="Author"
            value={draft.author}
            onChange={set("author")}
          />
          <TextField
            label="Pages"
            inputMode="numeric"
            value={draft.pageCount}
            onChange={set("pageCount")}
          />
        </div>
      </div>
      <ChoiceGroup
        label="Where are you with this book?"
        choices={whenChoices}
        value={when}
        onChange={setWhen}
      />
      {when === "past" ? (
        <PastBookSection draft={draft} onCancel={onCancel} />
      ) : (
        <>
          {shownError ? (
            <p role="alert" className="text-base text-danger">
              {shownError}
            </p>
          ) : null}
          {create.isError ? (
            <p role="alert" className="text-base text-danger">
              {create.error.message}
            </p>
          ) : null}
          {!online ? (
            <p className="text-sm text-ink-muted">
              Offline. Adding a book needs a connection.
            </p>
          ) : null}
          <div className="flex gap-sm">
            <Button
              variant="primary"
              isDisabled={!online || create.isPending}
              onPress={submit}
            >
              Add to shelf
            </Button>
            <Button onPress={onCancel}>Start again</Button>
          </div>
        </>
      )}
    </section>
  );
}

export function AddBookPage() {
  const online = useOnline();
  const lookup = useLookupIsbn();
  const search = useSearchLookupBooks();
  const [isbnInput, setIsbnInput] = useState("");
  const [isbnError, setIsbnError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);

  const reset = () => {
    setDraft(null);
    lookup.reset();
  };

  const lookUp = (isbn: string) => {
    lookup.mutate(isbn, {
      onSuccess: (book) => setDraft(draftFrom(book)),
    });
  };

  const submitIsbn = () => {
    const isbn = parseIsbn(isbnInput);
    if (!isbn) {
      setIsbnError("That is not a valid ISBN. Check the digits and try again.");
      return;
    }
    setIsbnError(null);
    lookUp(isbn);
  };

  if (draft) {
    return (
      <div className="flex max-w-narrow flex-col gap-xl">
        <h1 className="text-2xl font-medium">Add a book</h1>
        <ConfirmBook initial={draft} online={online} onCancel={reset} />
      </div>
    );
  }

  return (
    <div className="flex max-w-narrow flex-col gap-xl">
      <h1 className="text-2xl font-medium">Add a book</h1>
      {!online ? (
        <p role="status" className="text-sm text-ink-muted">
          Offline. Looking up and adding books need a connection. You can still
          fill in the details by hand.
        </p>
      ) : null}

      <section aria-labelledby="scan-h" className="flex flex-col gap-sm">
        <h2 id="scan-h" className="text-lg font-medium">
          Scan or type the ISBN
        </h2>
        <BarcodeScanner onIsbn={lookUp} />
        <form
          className="flex items-end gap-sm"
          onSubmit={(event) => {
            event.preventDefault();
            submitIsbn();
          }}
        >
          <TextField
            label="ISBN"
            inputMode="numeric"
            value={isbnInput}
            onChange={setIsbnInput}
            error={isbnError}
            className="flex-1"
          />
          <Button
            type="submit"
            isDisabled={!online || lookup.isPending}
            className="mb-0"
          >
            Look up
          </Button>
        </form>
        {lookup.isPending ? (
          <div
            aria-busy="true"
            role="status"
            className="h-12 rounded-md bg-surface-sunken p-sm text-sm text-ink-muted"
          >
            Looking up the book
          </div>
        ) : null}
        {lookup.isError ? (
          <p role="alert" className="text-base text-danger">
            {lookup.error.message}. Search by title or enter the book by hand.
          </p>
        ) : null}
      </section>

      <section aria-labelledby="search-h" className="flex flex-col gap-sm">
        <h2 id="search-h" className="text-lg font-medium">
          Search by title or author
        </h2>
        <form
          className="flex items-end gap-sm"
          onSubmit={(event) => {
            event.preventDefault();
            if (query.trim().length >= 2) search.mutate(query.trim());
          }}
        >
          <TextField
            label="Title or author"
            value={query}
            onChange={setQuery}
            className="flex-1"
          />
          <Button
            type="submit"
            isDisabled={!online || search.isPending || query.trim().length < 2}
          >
            Search
          </Button>
        </form>
        {search.isPending ? (
          <div
            aria-busy="true"
            role="status"
            className="h-12 rounded-md bg-surface-sunken p-sm text-sm text-ink-muted"
          >
            Searching
          </div>
        ) : null}
        {search.isError ? (
          <div role="alert" className="flex flex-col items-start gap-sm">
            <p className="text-base text-danger">{search.error.message}</p>
            <Button onPress={() => search.mutate(query.trim())}>
              Try again
            </Button>
          </div>
        ) : null}
        {search.data && search.data.items.length === 0 ? (
          <p className="text-base text-ink-muted">
            No books found. Try other words, or enter the book by hand.
          </p>
        ) : null}
        {search.data && search.data.items.length > 0 ? (
          <ul className="flex flex-col gap-sm">
            {search.data.items.map((item, index) => (
              <li
                key={`${item.isbn ?? "none"}-${index}`}
                className="flex items-center justify-between gap-md rounded-md border border-border bg-surface-raised p-md"
              >
                <div className="flex flex-col gap-xs">
                  <span className="font-serif text-base font-medium">
                    {item.title}
                  </span>
                  {item.author ? (
                    <span className="text-sm text-ink-muted">
                      {item.author}
                    </span>
                  ) : null}
                </div>
                <Button
                  aria-label={`Choose ${item.title}`}
                  onPress={() => setDraft(draftFrom(item))}
                >
                  Choose
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section aria-labelledby="hand-h" className="flex flex-col gap-sm">
        <h2 id="hand-h" className="text-lg font-medium">
          Enter by hand
        </h2>
        <div>
          <Button onPress={() => setDraft(emptyDraft)}>
            Enter the details myself
          </Button>
        </div>
      </section>
    </div>
  );
}
