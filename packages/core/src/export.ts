import type { Sql } from "./api/db.ts";
import { listBooks, type Book } from "./books.ts";
import { listAllInsights, type Insight } from "./insights.ts";
import { listAllSessions, type Session } from "./sessions.ts";
import { createZip } from "./zip.ts";

export const EXPORT_FORMATS = ["json", "markdown"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export type ExportReview = {
  rating: number | null;
  text: string | null;
  summary: string | null;
};

export type ExportReflection = {
  stage: "mid" | "end" | "recall";
  position: number;
  question: string;
  answer: string | null;
};

export type ExportBook = Book & {
  review: ExportReview | null;
  sessions: Session[];
  insights: Insight[];
  reflections: ExportReflection[];
};

export type VaultExport = { exportedAt: string; books: ExportBook[] };

export const parseExportFormat = (value: string | undefined) =>
  EXPORT_FORMATS.find((format) => format === value);

export const collectExport = async (sql: Sql, now: Date) => {
  const books = await listBooks(sql, undefined);
  const sessions = await listAllSessions(sql);
  const insights = await listAllInsights(sql);
  const reviews = await sql<
    {
      book_id: string;
      rating: number | null;
      text: string | null;
      summary: string | null;
    }[]
  >`select book_id, rating, text, summary from app.reviews`;
  const reflections = await sql<
    {
      book_id: string;
      stage: ExportReflection["stage"];
      position: number;
      question: string;
      answer: string | null;
    }[]
  >`
    select book_id, stage, position, question, answer from app.reflections
    order by stage, position
  `;
  return {
    exportedAt: now.toISOString(),
    books: books.map((book) => {
      const review = reviews.find((row) => row.book_id === book.id);
      return {
        ...book,
        review:
          review === undefined
            ? null
            : {
                rating: review.rating,
                text: review.text,
                summary: review.summary,
              },
        sessions: sessions.filter((row) => row.bookId === book.id),
        insights: insights.filter((row) => row.bookId === book.id),
        reflections: reflections
          .filter((row) => row.book_id === book.id)
          .map((row) => ({
            stage: row.stage,
            position: row.position,
            question: row.question,
            answer: row.answer,
          })),
      } satisfies ExportBook;
    }),
  } satisfies VaultExport;
};

const finished = (book: Book) => {
  if (book.finishedOn === null) {
    return undefined;
  }
  if (book.finishedPrecision === "year") {
    return book.finishedOn.slice(0, 4);
  }
  if (book.finishedPrecision === "month") {
    return book.finishedOn.slice(0, 7);
  }
  return book.finishedOn;
};

const bookMarkdown = (book: ExportBook) => {
  const lines = [`## ${book.title}`, ""];
  const facts = [
    book.author === null ? undefined : `by ${book.author}`,
    `status: ${book.status}`,
    finished(book) === undefined ? undefined : `finished: ${finished(book)}`,
    book.review?.rating == null ? undefined : `rating: ${book.review.rating}/5`,
  ].filter((fact) => fact !== undefined);
  lines.push(facts.join(" · "), "");
  if (book.review?.text) {
    lines.push("### Review", "", book.review.text, "");
  }
  if (book.insights.length > 0) {
    lines.push("### Insights", "");
    for (const insight of book.insights) {
      const page = insight.page === null ? "" : ` (p. ${insight.page})`;
      const mark = insight.kind === "quote" ? "> " : "";
      lines.push(
        `- ${mark}${insight.text}${page}${insight.pinned ? " ★" : ""}`,
      );
    }
    lines.push("");
  }
  if (book.sessions.length > 0) {
    lines.push("### Sessions", "");
    for (const session of book.sessions) {
      const pages =
        session.pageFrom === null
          ? ""
          : ` (pp. ${session.pageFrom}${session.pageTo === null ? "" : `-${session.pageTo}`})`;
      lines.push(`#### ${session.date}${pages}`, "");
      if (session.chapter !== null) {
        lines.push(`Chapter: ${session.chapter}`, "");
      }
      if (session.noteText !== null) {
        lines.push(session.noteText, "");
      }
    }
  }
  if (book.reflections.length > 0) {
    lines.push("### Reflections", "");
    for (const item of book.reflections) {
      lines.push(`**${item.question}**`, "", item.answer ?? "_No answer._", "");
    }
  }
  return lines.join("\n");
};

export const renderMarkdown = (data: VaultExport) =>
  [
    "# Reading vault export",
    "",
    `Exported ${data.exportedAt}`,
    "",
    ...data.books.map(bookMarkdown),
  ]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd() + "\n";

export const exportZipName = (data: VaultExport) =>
  `vault-${data.exportedAt.slice(0, 10)}.zip`;

export const buildExportZip = (data: VaultExport) => {
  const encoder = new TextEncoder();
  const day = data.exportedAt.slice(0, 10);
  return createZip([
    {
      name: `vault-${day}.json`,
      data: encoder.encode(JSON.stringify(data, null, 2)),
    },
    { name: `vault-${day}.md`, data: encoder.encode(renderMarkdown(data)) },
  ]);
};
