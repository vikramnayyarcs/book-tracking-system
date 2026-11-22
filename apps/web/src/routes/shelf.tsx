import { Link } from "@tanstack/react-router";
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

function Cover({ book, size }: { book: Book; size: "hero" | "row" }) {
  const box = size === "hero" ? "w-28 shrink-0 sm:w-36" : "w-14 shrink-0";
  if (book.coverUrl) {
    return (
      <img
        src={book.coverUrl}
        alt=""
        className={`${box} aspect-2/3 rounded-sm object-cover shadow-md`}
      />
    );
  }
  return (
    <div
      aria-hidden="true"
      className={`${box} flex aspect-2/3 items-end rounded-sm border-t-8 border-accent bg-surface-sunken p-xs font-serif shadow-md ${size === "hero" ? "text-base" : "text-xs"} leading-tight text-ink`}
    >
      {book.title}
    </div>
  );
}

function BookCard({
  book,
  online,
  hero,
}: {
  book: Book;
  online: boolean;
  hero: boolean;
}) {
  const update = useUpdateBookStatus();
  return (
    <li
      className={
        hero
          ? "flex gap-lg rounded-md border border-border bg-surface-raised p-lg shadow-lg"
          : "flex items-center gap-md border-b border-dashed border-border py-sm"
      }
    >
      <Cover book={book} size={hero ? "hero" : "row"} />
      <div className="flex min-w-0 flex-1 flex-col gap-sm">
        {hero ? (
          <p className="font-mono text-xs font-medium tracking-widest text-accent uppercase">
            Reading
          </p>
        ) : null}
        <div className="flex flex-col gap-xs">
          <h3
            className={`font-serif font-semibold tracking-tight ${hero ? "text-xl" : "text-base"}`}
          >
            <Link
              to="/books/$bookId"
              params={{ bookId: book.id }}
              className="underline outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {book.title}
            </Link>
          </h3>
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
      </div>
    </li>
  );
}

function ShelfSkeleton() {
  return (
    <div
      aria-busy="true"
      data-testid="shelf-loading"
      className="flex flex-col gap-md"
    >
      <div className="h-48 rounded-md bg-surface-sunken" />
      {[0, 1].map((i) => (
        <div key={i} className="h-20 rounded-md bg-surface-sunken" />
      ))}
    </div>
  );
}

export function ShelfPage() {
  const books = useBooks();
  const online = useOnline();

  return (
    <div className="flex flex-col gap-xl">
      <header className="flex flex-col gap-xs">
        <p className="font-mono text-xs font-medium tracking-widest text-ink-muted uppercase">
          Your shelf
        </p>
        <h1 className="text-3xl">Shelf</h1>
      </header>
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
              <h2
                id={`h-${section.key}`}
                className="border-b border-border pb-xs text-lg"
              >
                {section.heading}
              </h2>
              <ul className="flex flex-col gap-md">
                {section.books.map((b) => (
                  <BookCard
                    key={b.id}
                    book={b}
                    online={online}
                    hero={section.key === "reading"}
                  />
                ))}
              </ul>
            </section>
          ))
        : null}
    </div>
  );
}
