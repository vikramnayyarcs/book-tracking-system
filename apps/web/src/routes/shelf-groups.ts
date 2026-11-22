import type { components } from "@book-tracking-system/api-contract/types";

export type Book = components["schemas"]["Book"];
export type BookStatus = components["schemas"]["BookStatus"];

export interface ShelfSection {
  key: string;
  heading: string;
  books: Book[];
}

function finishedYear(book: Book) {
  return book.finishedOn ? book.finishedOn.slice(0, 4) : null;
}

function byFinishedDesc(a: Book, b: Book) {
  return (b.finishedOn ?? "").localeCompare(a.finishedOn ?? "");
}

export function groupShelf(books: Book[]) {
  const sections: ShelfSection[] = [];
  const reading = books.filter((b) => b.status === "reading");
  if (reading.length > 0) {
    sections.push({ key: "reading", heading: "Reading", books: reading });
  }

  const finished = books.filter((b) => b.status === "finished");
  const years = [
    ...new Set(
      finished.map(finishedYear).filter((y): y is string => y !== null),
    ),
  ].toSorted((a, b) => b.localeCompare(a));
  for (const year of years) {
    sections.push({
      key: `finished-${year}`,
      heading: `Finished ${year}`,
      books: finished
        .filter((b) => finishedYear(b) === year)
        .toSorted(byFinishedDesc),
    });
  }
  const undated = finished.filter((b) => finishedYear(b) === null);
  if (undated.length > 0) {
    sections.push({
      key: "finished-undated",
      heading: "Finished, date unknown",
      books: undated,
    });
  }

  const abandoned = books.filter((b) => b.status === "abandoned");
  if (abandoned.length > 0) {
    sections.push({
      key: "abandoned",
      heading: "Abandoned",
      books: abandoned,
    });
  }
  return sections;
}

export function statusPatch(from: BookStatus, to: BookStatus, today: string) {
  if (to === "finished") {
    return {
      status: to,
      finishedOn: today,
      finishedPrecision: "day",
    } satisfies components["schemas"]["BookUpdate"];
  }
  if (from === "finished") {
    return {
      status: to,
      finishedOn: null,
      finishedPrecision: null,
    } satisfies components["schemas"]["BookUpdate"];
  }
  return { status: to } satisfies components["schemas"]["BookUpdate"];
}
