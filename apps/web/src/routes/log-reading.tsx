import { Link, Navigate } from "@tanstack/react-router";
import { useReadingBooks } from "../api/hooks.ts";
import { Button } from "../ui/button.tsx";

export function LogReadingPage() {
  const reading = useReadingBooks();
  if (reading.isPending) {
    return (
      <div
        role="status"
        aria-label="Opening Log session"
        className="h-lg w-2xl rounded-sm bg-surface-sunken"
      />
    );
  }
  if (reading.isError) {
    return (
      <div className="flex flex-col items-start gap-sm">
        <h1 className="font-serif text-2xl font-semibold">Log session</h1>
        <p className="rounded-md bg-danger-subtle px-md py-sm text-danger-subtle-ink">
          {reading.error.message}
        </p>
        <Button onPress={() => void reading.refetch()}>Try again</Button>
      </div>
    );
  }
  const book = reading.data.items[0];
  if (book) {
    return (
      <Navigate to="/books/$bookId/log" params={{ bookId: book.id }} replace />
    );
  }
  return (
    <>
      <h1 className="mb-sm font-serif text-2xl font-semibold">Log session</h1>
      <p className="mb-md text-ink-muted">
        No book is in Reading. Start a book, then log a session.
      </p>
      <Link
        to="/books/new"
        className="inline-flex min-h-11 items-center rounded-md bg-accent px-md text-base font-medium text-accent-ink outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        Add a book
      </Link>
    </>
  );
}
