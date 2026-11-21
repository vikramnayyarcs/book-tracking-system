import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import fixture from "./fixtures/open-library-isbn.json" with { type: "json" };
import { lookupIsbn, normalizeIsbn } from "./isbn.ts";

const server = setupServer(
  http.get("https://openlibrary.test/api/books", ({ request }) => {
    const key = new URL(request.url).searchParams.get("bibkeys");
    return key === "ISBN:9780140328721"
      ? HttpResponse.json(fixture)
      : HttpResponse.json({});
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

describe("normalizeIsbn", () => {
  it("accepts ISBN-13 and ISBN-10 with separators and a check digit", () => {
    expect(normalizeIsbn("978-0-14-032872-1")).toBe("9780140328721");
    expect(normalizeIsbn("0306406152")).toBe("0306406152");
    expect(normalizeIsbn("080442957X")).toBe("080442957X");
  });

  it("rejects a wrong check digit, wrong length and letters", () => {
    expect(normalizeIsbn("9780140328722")).toBeUndefined();
    expect(normalizeIsbn("030640615")).toBeUndefined();
    expect(normalizeIsbn("abcdefghij")).toBeUndefined();
  });
});

describe("lookupIsbn", () => {
  it("maps the Open Library record", async () => {
    expect(await lookupIsbn("9780140328721", options)).toEqual({
      isbn: "9780140328721",
      title: "Fantastic Mr. Fox",
      author: "Roald Dahl",
      coverUrl: "https://covers.openlibrary.org/b/id/15152634-M.jpg",
      pageCount: 96,
    });
  });

  it("returns undefined when Open Library has no record", async () => {
    expect(await lookupIsbn("9780306406157", options)).toBeUndefined();
  });

  it("throws when Open Library fails", async () => {
    server.use(
      http.get("https://openlibrary.test/api/books", () =>
        HttpResponse.text("down", { status: 503 }),
      ),
    );
    await expect(lookupIsbn("9780140328721", options)).rejects.toThrow(
      "Open Library returned 503",
    );
  });
});
