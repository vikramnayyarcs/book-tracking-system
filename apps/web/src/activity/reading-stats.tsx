import { useStats } from "../api/hooks.ts";
import { Button } from "../ui/button.tsx";
import { meta } from "../ui/styles.ts";
import {
  booksSummary,
  monthLabel,
  monthLong,
  percent,
  starsLabel,
  total,
} from "./stats-logic.ts";

const th = "px-sm py-xs text-left font-medium";
const td = "px-sm py-xs font-mono";

export function ReadingStats() {
  const stats = useStats();

  if (stats.isPending) {
    return (
      <div aria-busy="true" data-testid="stats-loading" className="grid gap-md">
        {[0, 1].map((i) => (
          <div key={i} className="h-40 rounded-md bg-surface-sunken" />
        ))}
      </div>
    );
  }
  if (stats.isError) {
    return (
      <div role="alert" className="flex flex-col items-start gap-sm">
        <p className="text-base text-danger">{stats.error.message}</p>
        <Button onPress={() => void stats.refetch()}>Try again</Button>
      </div>
    );
  }

  const months = stats.data.booksFinishedPerMonth;
  const ratings = stats.data.ratings;
  const finished = total(months);
  const maxMonth = Math.max(0, ...months.map((m) => m.count));
  const maxRating = Math.max(0, ...ratings.map((r) => r.count));
  const rated = total(ratings);

  return (
    <section aria-labelledby="stats-heading" className="flex flex-col gap-lg">
      <h2 id="stats-heading" className="text-xl font-medium">
        Reading stats
      </h2>

      <section
        aria-labelledby="books-month-heading"
        className="flex flex-col gap-sm"
      >
        <h3 id="books-month-heading" className={meta}>
          Books per month
        </h3>
        <p className="font-mono text-2xl">{finished}</p>
        <p className="text-base text-ink-muted">{booksSummary(finished)}</p>
        <div
          role="img"
          aria-label={booksSummary(finished)}
          className="flex h-40 items-end gap-xs border-b border-border-strong"
        >
          {months.map((m) => (
            <div
              key={m.month}
              className="flex h-full min-w-0 flex-1 flex-col justify-end"
            >
              <span
                aria-hidden="true"
                className="text-center font-mono text-xs text-ink-muted"
              >
                {m.count}
              </span>
              <div
                aria-hidden="true"
                className="rounded-t-sm bg-accent"
                style={{
                  height: `${percent(m.count, maxMonth) * 0.85}%`,
                  minHeight: m.count > 0 ? "0.25rem" : 0,
                }}
              />
            </div>
          ))}
        </div>
        <ol aria-hidden="true" className="flex gap-xs">
          {months.map((m) => (
            <li
              key={m.month}
              className="min-w-0 flex-1 text-center font-mono text-xs text-ink-muted"
            >
              {monthLabel(m.month)}
            </li>
          ))}
        </ol>
        <details>
          <summary className="cursor-pointer py-xs text-base">
            Show books per month as a table
          </summary>
          <table className="w-full text-sm">
            <caption className="sr-only">Books finished per month</caption>
            <thead>
              <tr>
                <th scope="col" className={th}>
                  Month
                </th>
                <th scope="col" className={th}>
                  Books
                </th>
              </tr>
            </thead>
            <tbody>
              {months.map((m) => (
                <tr
                  key={m.month}
                  className="border-t border-dashed border-border"
                >
                  <th scope="row" className={th}>
                    {monthLong(m.month)}
                  </th>
                  <td className={td}>{m.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </section>

      <section
        aria-labelledby="ratings-heading"
        className="flex flex-col gap-sm"
      >
        <h3 id="ratings-heading" className={meta}>
          Ratings
        </h3>
        {rated === 0 ? (
          <p className="text-base text-ink-muted">
            No ratings yet. Rate a book when you finish it and it shows up here.
          </p>
        ) : null}
        <ul className="flex flex-col gap-xs">
          {ratings.map((r) => (
            <li key={r.rating} className="flex items-center gap-sm">
              <span className="w-16 shrink-0 font-mono text-sm">
                {starsLabel(r.rating)}
              </span>
              <span
                aria-hidden="true"
                className="h-4 flex-1 rounded-sm bg-surface-sunken"
              >
                <span
                  className="block h-full rounded-sm bg-accent"
                  style={{ width: `${percent(r.count, maxRating)}%` }}
                />
              </span>
              <span className="w-8 shrink-0 text-right font-mono text-sm">
                {r.count}
                <span className="sr-only">
                  {r.count === 1 ? " book" : " books"}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}
