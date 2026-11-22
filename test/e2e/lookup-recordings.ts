import type { Page } from "@playwright/test";
import { apiBase, fulfillJson } from "./web-stack.ts";

export const recordedIsbn = "9780306406157";

export const recordedIsbnBook = {
  isbn: recordedIsbn,
  title: "Invented Tidewater Atlas",
  author: "Invented Author",
  coverUrl: null,
  pageCount: 240,
};

export const recordedSearchItems = [
  {
    title: "Invented Lantern Almanac",
    author: "Invented Author",
    isbn: null,
    coverUrl: null,
    pageCount: 180,
  },
  {
    title: "Invented Lantern Atlas",
    author: "Another Invented Author",
    isbn: "9780306406157",
    coverUrl: null,
    pageCount: null,
  },
];

export const replayOpenLibrary = async (page: Page) => {
  await page.route(`${apiBase}/v1/lookup/isbn/*`, async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fallback();
      return;
    }
    const isbn = new URL(route.request().url()).pathname.split("/").at(-1);
    if (isbn === recordedIsbn) {
      await fulfillJson(route, 200, recordedIsbnBook);
      return;
    }
    await fulfillJson(route, 404, {
      title: "No book was found for that ISBN",
      status: 404,
    });
  });
  await page.route(`${apiBase}/v1/lookup/books*`, async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fallback();
      return;
    }
    const q = new URL(route.request().url()).searchParams.get("q");
    await fulfillJson(route, 200, {
      items: q === "invented lantern" ? recordedSearchItems : [],
    });
  });
};
