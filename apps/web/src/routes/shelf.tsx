import { useBooks, useUpdateBookStatus } from "../api/hooks.ts";
import { useOnline } from "../ui/online.ts";
import { Button } from "../ui/button.tsx";
import { StatusSelect } from "../ui/status-select.tsx";
import {
  type Book,
  type BookStatus,
  groupShelf,
  statusPatch,
} from "./shelf-groups.ts";

const statusOptions = [
  { id: "reading", label: "Reading" },
  { id: "finished", label: "Finished" },
  { id: "abandoned", label: "Abandoned" },
];

const pad = (n: number) => String(n).padStart(2, "0");

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function Cover({ book }: { book: Book }) {
  if (book.coverUrl) {
    return (
      <img
        src={book.coverUrl}
        alt=""
        className="aspect-2/3 w-full rounded-md border border-border object-cover"
      />
    );
  }
  return (
    <div
      aria-hidden="true"
      className="flex aspect-2/3 w-full items-center justify-center rounded-md border border-border bg-accent-subtle p-sm text-center font-serif text-base text-accent-subtle-ink"
    >
      {book.title}
    </div>
  );
}

function BookCard({ book, online }: { book: Book; online: boolean }) {
  const update = useUpdateBookStatus();
  return (
    <li className="flex flex-col gap-sm">
      <Cover book={book} />
      <div className="flex flex-col gap-xs">
        <h3 className="font-serif text-base font-medium">{book.title}</h3>
        {book.author ? (
          <p className="text-sm text-ink-muted">{book.author}</p>
        ) : null}
      </div>
      <StatusSelect
        label={`Status of ${book.title}`}
        options={statusOptions}
        value={book.status}
        isDisabled={!online || update.isPending}
        onChange={(to) => {
          if (to === book.status) return;
          update.mutate({
            id: book.id,
            body: statusPatch(book.status, to as BookStatus, today()),
          });
        }}
      />
      {!online ? (
        <p className="text-sm text-ink-muted">
          Offline. Status changes need a connection.
        </p>
      ) : null}
      {update.isError ? (
        <p role="alert" className="text-sm text-danger">
          {update.error.message}
        </p>
      ) : null}
    </li>
  );
}

function ShelfSkeleton() {
  return (
    <div
      aria-busy="true"
      data-testid="shelf-loading"
      className="grid grid-cols-2 gap-md sm:grid-cols-3"
    >
      {[0, 1, 2].map((i) => (
        <div key={i} className="aspect-2/3 rounded-md bg-surface-sunken" />
      ))}
    </div>
  );
}

export function ShelfPage() {
  const books = useBooks();
  const online = useOnline();

  return (
    <div className="flex flex-col gap-xl">
      <h1 className="text-2xl font-medium">Shelf</h1>
      {books.isPending ? <ShelfSkeleton /> : null}
      {books.isError ? (
        <div role="alert" className="flex flex-col items-start gap-sm">
          <p className="text-base text-danger">{books.error.message}</p>
          <Button onPress={() => void books.refetch()}>Try again</Button>
        </div>
      ) : null}
      {books.data && books.data.items.length === 0 ? (
        <div className="flex flex-col items-start gap-sm">
          <p className="text-base text-ink-muted">
            Your shelf is empty. Add the book you are reading now.
          </p>
          <a
            href="/books/new"
            className="inline-flex min-h-11 items-center rounded-md bg-accent px-md text-base font-medium text-accent-ink outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Add a book
          </a>
        </div>
      ) : null}
      {books.data
        ? groupShelf(books.data.items).map((section) => (
            <section
              key={section.key}
              aria-labelledby={`h-${section.key}`}
              className="flex flex-col gap-md"
            >
              <h2 id={`h-${section.key}`} className="text-lg font-medium">
                {section.heading}
              </h2>
              <ul className="grid grid-cols-2 gap-md sm:grid-cols-3">
                {section.books.map((b) => (
                  <BookCard key={b.id} book={b} online={online} />
                ))}
              </ul>
            </section>
          ))
        : null}
    </div>
  );
}
