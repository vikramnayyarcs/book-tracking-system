import { brand } from "@book-tracking-system/core/brand";
import { Link, Navigate, Outlet } from "@tanstack/react-router";
import { useReadingBooks } from "../api/hooks.ts";
import { useSession } from "../auth/session.tsx";
import { useOnline } from "../ui/online.ts";

const focus =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const navLink = `inline-flex min-h-11 items-center rounded-md px-md text-base ${focus} text-ink-muted`;
const navActive = "bg-accent-subtle text-accent-subtle-ink font-medium";

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

export function AppLayout() {
  const session = useSession();

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
    <div className="flex min-h-dvh flex-col bg-surface text-ink">
      <header className="bg-chrome text-chrome-ink">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-sm px-md py-sm">
          <p className="text-lg font-medium">{brand.name}</p>
          <LogSessionShortcut />
        </div>
      </header>
      <OfflineBanner />
      <main className="mx-auto w-full max-w-3xl flex-1 px-md py-lg">
        <Outlet />
      </main>
      <nav
        aria-label="Main"
        className="sticky bottom-0 border-t border-border bg-surface-raised"
      >
        <ul className="mx-auto flex max-w-3xl justify-around gap-sm p-sm">
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
