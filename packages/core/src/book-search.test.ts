import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { searchBooks } from "./book-search.ts";
import fixture from "./fixtures/open-library-search.json" with { type: "json" };

const server = setupServer(
  http.get("https://openlibrary.test/search.json", ({ request }) => {
    const url = new URL(request.url);
    return url.searchParams.get("q") === "fantastic fox"
      ? HttpResponse.json(fixture)
      : HttpResponse.json({ numFound: 0, start: 0, docs: [] });
  }),
);

beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const options = {
  fetch: (input: Parameters<typeof fetch>[0], init?: RequestInit) =>
    fetch(input, init),
  baseUrl: "https://openlibrary.test",
};

describe("searchBooks", () => {
  it("maps records, skips untitled ones and invalid ISBNs", async () => {
    expect(await searchBooks("fantastic fox", options)).toEqual([
      {
        title: "Fantastic Mr. Fox",
        author: "Roald Dahl",
        isbn: "9780140328721",
        coverUrl: "https://covers.openlibrary.org/b/id/15152634-M.jpg",
        pageCount: 96,
      },
      {
        title: "Untitled Field Notes",
        author: null,
        isbn: null,
        coverUrl: null,
        pageCount: null,
      },
    ]);
  });

  it("returns an empty list when nothing matches", async () => {
    expect(await searchBooks("zzzz", options)).toEqual([]);
  });

  it("throws when Open Library fails", async () => {
    server.use(
      http.get("https://openlibrary.test/search.json", () =>
        HttpResponse.text("down", { status: 503 }),
      ),
    );
    await expect(searchBooks("fantastic fox", options)).rejects.toThrow(
      "Open Library returned 503",
    );
  });
});
