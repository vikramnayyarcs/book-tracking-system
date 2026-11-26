import { useState } from "react";
import { buildYear, daySummary, longDate } from "../activity/activity-logic.ts";
import { ReadingStats } from "../activity/reading-stats.tsx";
import { useActivity } from "../api/hooks.ts";
import { Button } from "../ui/button.tsx";
import { meta } from "../ui/styles.ts";

const weekdays = ["M", "T", "W", "T", "F", "S", "S"];

function Skeleton() {
  return (
    <div
      aria-busy="true"
      data-testid="activity-loading"
      className="grid gap-md"
    >
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-32 rounded-md bg-surface-sunken" />
      ))}
    </div>
  );
}

export function ActivityPage() {
  const [year, setYear] = useState(() => new Date().getFullYear());
  const activity = useActivity(year);
  const dates = activity.data?.dates ?? [];

  return (
    <div className="flex max-w-page flex-col gap-lg">
      <h1 className="text-2xl font-medium">Activity</h1>
      <div className="flex items-center gap-sm">
        <Button onPress={() => setYear(year - 1)}>
          <span aria-hidden="true">&larr;</span>
          <span className="sr-only">Previous year</span>
        </Button>
        <h2 className="min-w-20 text-center font-mono text-lg">{year}</h2>
        <Button onPress={() => setYear(year + 1)}>
          <span aria-hidden="true">&rarr;</span>
          <span className="sr-only">Next year</span>
        </Button>
      </div>
      <div aria-live="polite" className="flex flex-col gap-md">
        {activity.isPending ? <Skeleton /> : null}
        {activity.isError ? (
          <div role="alert" className="flex flex-col items-start gap-sm">
            <p className="text-base text-danger">{activity.error.message}</p>
            <Button onPress={() => void activity.refetch()}>Try again</Button>
          </div>
        ) : null}
        {activity.data ? (
          <>
            <p className="text-base text-ink-muted">
              {daySummary(dates.length, year)}
              {dates.length === 0
                ? " Log a session and the day shows up here."
                : ""}
            </p>
            <div className="grid gap-lg sm:grid-cols-2 wide:grid-cols-3">
              {buildYear(year, dates).map((m) => (
                <section key={m.month} aria-label={m.name}>
                  <h3 className={`${meta} mb-sm`}>{m.name}</h3>
                  <ol className="grid grid-cols-7 gap-xs">
                    {weekdays.map((d, i) => (
                      <li
                        key={i}
                        aria-hidden="true"
                        className="text-center font-mono text-xs text-ink-muted"
                      >
                        {d}
                      </li>
                    ))}
                    {Array.from({ length: m.blanks }, (_, i) => (
                      <li key={`b${i}`} aria-hidden="true" />
                    ))}
                    {m.days.map((d) =>
                      d.active ? (
                        <li
                          key={d.date}
                          className="grid size-8 place-items-center rounded-sm border-2 border-accent bg-accent font-mono text-xs font-medium text-accent-ink"
                        >
                          {d.day}
                          <span className="sr-only">
                            , {longDate(d.date)}, has an entry
                          </span>
                        </li>
                      ) : (
                        <li
                          key={d.date}
                          aria-hidden="true"
                          className="grid size-8 place-items-center rounded-sm bg-surface-sunken font-mono text-xs text-ink-muted"
                        >
                          {d.day}
                        </li>
                      ),
                    )}
                  </ol>
                </section>
              ))}
            </div>
          </>
        ) : null}
      </div>
      <ReadingStats />
    </div>
  );
}
