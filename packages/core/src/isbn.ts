export const normalizeIsbn = (input: string) => {
  const digits = input.replace(/[\s-]/g, "").toUpperCase();
  if (/^\d{13}$/.test(digits)) {
    let sum = 0;
    for (let i = 0; i < 13; i += 1) {
      sum += Number(digits[i]) * (i % 2 === 0 ? 1 : 3);
    }
    return sum % 10 === 0 ? digits : undefined;
  }
  if (/^\d{9}[\dX]$/.test(digits)) {
    let sum = 0;
    for (let i = 0; i < 10; i += 1) {
      const char = digits[i];
      sum += (char === "X" ? 10 : Number(char)) * (10 - i);
    }
    return sum % 11 === 0 ? digits : undefined;
  }
  return undefined;
};

export type BookLookup = {
  isbn: string;
  title: string;
  author: string | null;
  coverUrl: string | null;
  pageCount: number | null;
};

type OpenLibraryBook = {
  title?: unknown;
  authors?: { name?: unknown }[];
  number_of_pages?: unknown;
  cover?: { medium?: unknown; large?: unknown };
};

export const lookupIsbn = async (
  isbn: string,
  options: { fetch: typeof fetch; baseUrl: string },
) => {
  const key = `ISBN:${isbn}`;
  const url = `${options.baseUrl}/api/books?bibkeys=${key}&format=json&jscmd=data`;
  const response = await options.fetch(url, {
    headers: { accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Open Library returned ${response.status}`);
  }
  const body = (await response.json()) as Record<string, OpenLibraryBook>;
  const book = body[key];
  if (book === undefined || typeof book.title !== "string") {
    return undefined;
  }
  const firstAuthor = book.authors?.[0]?.name;
  const cover = book.cover?.medium ?? book.cover?.large;
  const pages = book.number_of_pages;
  return {
    isbn,
    title: book.title,
    author: typeof firstAuthor === "string" ? firstAuthor : null,
    coverUrl: typeof cover === "string" ? cover : null,
    pageCount:
      typeof pages === "number" && Number.isInteger(pages) && pages > 0
        ? pages
        : null,
  } satisfies BookLookup;
};
