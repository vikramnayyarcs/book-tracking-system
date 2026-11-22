import { brand } from "@book-tracking-system/core/brand";
import { Link, Navigate, Outlet } from "@tanstack/react-router";
import { useEffect } from "react";
import { useReadingBooks } from "../api/hooks.ts";
import { useSession } from "../auth/session.tsx";
import { waitingSummary } from "../log/queue-logic.ts";
import { startQueueRunner } from "../log/queue-runner.ts";
import { useQueueEntries } from "../log/use-queue.ts";
import { useOnline } from "../ui/online.ts";

const focus =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const navLink = `inline-flex min-h-11 items-center rounded-md px-md text-base ${focus} text-ink-muted`;
const navActive =
  "text-accent font-semibold underline decoration-2 underline-offset-8";

function LogSessionShortcut() {
  const reading = useReadingBooks();
  const book = reading.data?.items[0];
  if (!book) return null;
  return (
    <Link
      to="/books/$bookId/log"
      params={{ bookId: book.id }}
      className={`inline-flex min-h-11 items-center rounded-md bg-accent px-md text-base font-medium text-accent-ink ${focus}`}
    >
      Log session
      <span className="sr-only">: {book.title}</span>
    </Link>
  );
}

function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <p role="status" className="bg-surface-sunken px-md py-sm text-sm text-ink">
      You are offline. You see the last data this device loaded. Session notes
      still save and upload when you are back online.
    </p>
  );
}

const count = (n: number) => `${n} session${n === 1 ? "" : "s"}`;

function UploadStatus() {
  const entries = useQueueEntries();
  const { waiting, rejected } = waitingSummary(entries ?? []);
  if (waiting + rejected === 0) return null;
  return (
    <p
      role="status"
      className="bg-accent-subtle px-md py-sm text-sm text-accent-subtle-ink"
    >
      {waiting > 0 ? `${count(waiting)} waiting to upload. ` : ""}
      {rejected > 0 ? `${count(rejected)} refused by the server.` : ""}
    </p>
  );
}

export function AppLayout() {
  const session = useSession();
  const signedIn = session.isLoaded && session.isSignedIn;

  useEffect(() => (signedIn ? startQueueRunner() : undefined), [signedIn]);

  if (!session.isLoaded) {
    return (
      <div
        aria-busy="true"
        className="min-h-dvh bg-surface"
        data-testid="shell-loading"
      />
    );
  }
  if (!session.isSignedIn) {
    return <Navigate to="/sign-in" replace />;
  }

  return (
    <div className="flex h-dvh flex-col bg-surface text-ink">
      <header className="border-b border-border bg-chrome text-chrome-ink">
        <div className="mx-auto flex max-w-page flex-wrap items-center justify-between gap-sm px-md py-sm">
          <p className="flex items-center gap-sm font-serif text-lg font-semibold tracking-tight">
            <span
              aria-hidden="true"
              className="grid size-8 place-items-center rounded-sm bg-accent font-mono text-xs text-accent-ink"
            >
              {brand.name.slice(0, 2).toUpperCase()}
            </span>
            {brand.name}
          </p>
          <LogSessionShortcut />
        </div>
      </header>
      <OfflineBanner />
      <UploadStatus />
      <div className="flex-1 overflow-y-auto">
        <main className="mx-auto w-full max-w-page px-md py-lg">
          <Outlet />
        </main>
      </div>
      <nav
        aria-label="Main"
        className="border-t border-border bg-surface-raised"
      >
        <ul className="mx-auto flex max-w-page justify-around gap-sm p-sm">
          {(
            [
              ["/", "Shelf"],
              ["/search", "Search"],
              ["/settings", "Settings"],
            ] as const
          ).map(([to, label]) => (
            <li key={to}>
              <Link
                to={to}
                className={navLink}
                activeProps={{ className: `${navLink} ${navActive}` }}
                activeOptions={{ exact: true }}
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
