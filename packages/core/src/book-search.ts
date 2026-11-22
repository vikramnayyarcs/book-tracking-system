import { normalizeIsbn } from "./isbn.ts";

export type BookSearchResult = {
  title: string;
  author: string | null;
  isbn: string | null;
  coverUrl: string | null;
  pageCount: number | null;
};

type OpenLibraryDoc = {
  title?: unknown;
  author_name?: unknown;
  cover_i?: unknown;
  number_of_pages_median?: unknown;
  isbn?: unknown;
};

const limit = 10;

export const searchBooks = async (
  query: string,
  options: { fetch: typeof fetch; baseUrl: string },
) => {
  const params = new URLSearchParams({
    q: query,
    limit: String(limit),
    fields: "key,title,author_name,cover_i,number_of_pages_median,isbn",
  });
  const response = await options.fetch(
    `${options.baseUrl}/search.json?${params.toString()}`,
    { headers: { accept: "application/json" } },
  );
  if (!response.ok) {
    throw new Error(`Open Library returned ${response.status}`);
  }
  const body = (await response.json()) as { docs?: OpenLibraryDoc[] };
  const results: BookSearchResult[] = [];
  for (const doc of body.docs ?? []) {
    if (typeof doc.title !== "string" || doc.title === "") {
      continue;
    }
    const authors = Array.isArray(doc.author_name) ? doc.author_name : [];
    const isbns = Array.isArray(doc.isbn) ? doc.isbn : [];
    const pages = doc.number_of_pages_median;
    results.push({
      title: doc.title,
      author: typeof authors[0] === "string" ? authors[0] : null,
      isbn:
        isbns
          .map((value) =>
            typeof value === "string" ? normalizeIsbn(value) : undefined,
          )
          .find((value) => value !== undefined) ?? null,
      coverUrl:
        typeof doc.cover_i === "number" && Number.isInteger(doc.cover_i)
          ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
          : null,
      pageCount:
        typeof pages === "number" && Number.isInteger(pages) && pages > 0
          ? pages
          : null,
    });
  }
  return results.slice(0, limit);
};
