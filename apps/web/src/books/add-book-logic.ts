import type { components } from "@book-tracking-system/api-contract/types";
import { normalizeIsbn } from "@book-tracking-system/core/isbn";

type BookCreate = components["schemas"]["BookCreate"];

export type Draft = {
  isbn: string;
  title: string;
  author: string;
  coverUrl: string;
  pageCount: string;
};

export const emptyDraft: Draft = {
  isbn: "",
  title: "",
  author: "",
  coverUrl: "",
  pageCount: "",
};

export function parseIsbn(input: string) {
  return normalizeIsbn(input);
}

export function draftFrom(source: {
  isbn?: string | null;
  title: string;
  author: string | null;
  coverUrl: string | null;
  pageCount: number | null;
}) {
  const draft: Draft = {
    isbn: source.isbn ?? "",
    title: source.title,
    author: source.author ?? "",
    coverUrl: source.coverUrl ?? "",
    pageCount: source.pageCount === null ? "" : String(source.pageCount),
  };
  return draft;
}

export function draftError(draft: Draft) {
  if (draft.title.trim() === "") return "Enter a title.";
  if (draft.title.trim().length > 300) return "The title is too long.";
  const pages = draft.pageCount.trim();
  if (pages !== "" && !/^[1-9]\d{0,5}$/.test(pages)) {
    return "Enter the page count as a whole number, or leave it empty.";
  }
  return null;
}

export function bookBody(draft: Draft) {
  const body: BookCreate = { title: draft.title.trim(), status: "reading" };
  if (draft.isbn.trim() !== "") body.isbn = draft.isbn.trim();
  if (draft.author.trim() !== "") body.author = draft.author.trim();
  if (draft.coverUrl.trim() !== "") body.coverUrl = draft.coverUrl.trim();
  if (draft.pageCount.trim() !== "") {
    body.pageCount = Number(draft.pageCount.trim());
  }
  return body;
}

export function scannedIsbn(codes: { rawValue: string }[]) {
  for (const code of codes) {
    const isbn = normalizeIsbn(code.rawValue);
    if (isbn) return isbn;
  }
  return undefined;
}
