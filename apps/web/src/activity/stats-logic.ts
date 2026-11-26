export const monthLabel = (month: string) =>
  new Intl.DateTimeFormat("en", {
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T00:00:00Z`));

export const monthLong = (month: string) =>
  new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T00:00:00Z`));

export const percent = (value: number, max: number) =>
  max <= 0 ? 0 : Math.round((value / max) * 100);

export const total = (counts: readonly { count: number }[]) =>
  counts.reduce((sum, c) => sum + c.count, 0);

export const starsLabel = (rating: number) =>
  `${rating} ${rating === 1 ? "star" : "stars"}`;

export const booksSummary = (count: number) =>
  `${count} ${count === 1 ? "book" : "books"} finished in the last 12 months.`;
