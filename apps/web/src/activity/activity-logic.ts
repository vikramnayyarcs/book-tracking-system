export type DayCell = { day: number; date: string; active: boolean };

export type MonthGrid = {
  month: number;
  name: string;
  blanks: number;
  days: DayCell[];
};

const pad = (n: number) => String(n).padStart(2, "0");

export const buildYear = (year: number, dates: readonly string[]) => {
  const active = new Set(dates);
  return Array.from({ length: 12 }, (_a, month) => {
    const first = new Date(Date.UTC(year, month, 1));
    const length = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    return {
      month,
      name: new Intl.DateTimeFormat("en", {
        month: "long",
        timeZone: "UTC",
      }).format(first),
      blanks: (first.getUTCDay() + 6) % 7,
      days: Array.from({ length }, (_b, i) => {
        const date = `${year}-${pad(month + 1)}-${pad(i + 1)}`;
        return { day: i + 1, date, active: active.has(date) };
      }),
    };
  });
};

export const longDate = (date: string) =>
  new Intl.DateTimeFormat("en", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));

export const daySummary = (count: number, year: number) =>
  count === 0
    ? `No entries in ${year} yet.`
    : `${count} ${count === 1 ? "day" : "days"} with an entry in ${year}.`;
