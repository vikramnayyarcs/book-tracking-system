import type { APIResponse, Page, Route } from "@playwright/test";
import { sessionTokenFor } from "../api/clerk.ts";

export const apiBase =
  process.env["API_BASE_URL"] ?? "http://127.0.0.1:54321/functions/v1/api";
export const gatewaySecret =
  process.env["GATEWAY_SECRET"] ?? "ci-gateway-secret";
const storageBase = process.env["STORAGE_BASE_URL"] ?? "http://127.0.0.1:54321";
const appOrigin = "http://localhost:4173";

const corsHeaders = {
  "access-control-allow-origin": appOrigin,
  "access-control-allow-headers": "authorization, content-type, x-client-info",
  "access-control-allow-methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
};

export const fulfillJson = async (
  route: Route,
  status: number,
  body: unknown,
) => {
  await route.fulfill({
    status,
    headers: {
      ...corsHeaders,
      "content-type":
        status < 400 ? "application/json" : "application/problem+json",
    },
    body: JSON.stringify(body),
  });
};

export const removeBooksTitled = async (externalId: string, title: string) => {
  const headers = await seedHeaders(externalId);
  const list = await fetch(`${apiBase}/v1/books`, { headers });
  const { items } = (await list.json()) as {
    items: { id: string; title: string }[];
  };
  for (const book of items.filter((item) => item.title === title)) {
    await fetch(`${apiBase}/v1/books/${book.id}`, {
      method: "DELETE",
      headers,
    });
  }
};

export const seedHeaders = async (externalId: string) => {
  const { token } = await sessionTokenFor(externalId);
  return {
    authorization: `Bearer ${token}`,
    "x-gateway-secret": gatewaySecret,
    "content-type": "application/json",
  };
};

export const seedBook = async (externalId: string, title: string) => {
  const headers = await seedHeaders(externalId);
  const response = await fetch(`${apiBase}/v1/books`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      title,
      author: "Invented Author",
      status: "reading",
    }),
  });
  const book = (await response.json()) as { id: string };
  return {
    id: book.id,
    remove: async () => {
      await fetch(`${apiBase}/v1/books/${book.id}`, {
        method: "DELETE",
        headers,
      });
    },
  };
};

const withCors = async (route: Route, response: APIResponse) => {
  await route.fulfill({
    response,
    headers: { ...response.headers(), ...corsHeaders },
  });
};

const preflight = async (route: Route) => {
  const response = await route.fetch({
    url: `${apiBase}/v1/health`,
    method: "GET",
    headers: { "x-gateway-secret": gatewaySecret },
  });
  await withCors(route, response);
};

const endedMessage =
  /Test ended|Target page, context or browser has been closed/;

const ignoreEnded =
  (handler: (route: Route) => Promise<void>) => async (route: Route) => {
    try {
      await handler(route);
    } catch (error) {
      if (!endedMessage.test(String(error))) {
        throw error;
      }
    }
  };

export const routeStack = async (page: Page) => {
  const calls: string[] = [];
  await page.route(
    `${apiBase}/**`,
    ignoreEnded(async (route) => {
      const request = route.request();
      if (request.method() === "OPTIONS") {
        await preflight(route);
        return;
      }
      calls.push(`${request.method()} ${new URL(request.url()).pathname}`);
      const response = await route.fetch({
        headers: { ...request.headers(), "x-gateway-secret": gatewaySecret },
      });
      await withCors(route, response);
    }),
  );
  await page.route(
    "**/storage/v1/object/upload/sign/**",
    ignoreEnded(async (route) => {
      const request = route.request();
      if (request.method() === "OPTIONS") {
        await preflight(route);
        return;
      }
      const url = new URL(request.url());
      calls.push(`${request.method()} storage-upload`);
      const response = await route.fetch({
        url: `${storageBase}${url.pathname}${url.search}`,
      });
      await withCors(route, response);
    }),
  );
  return calls;
};

export const seedNotes = async (externalId: string, bookId: string) => {
  const headers = await seedHeaders(externalId);
  const post = (path: string, body: unknown) =>
    fetch(`${apiBase}/v1${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  await post("/sessions", {
    id: crypto.randomUUID(),
    bookId,
    date: "2026-03-01",
    pageFrom: 10,
    pageTo: 24,
    noteText: "Invented note: routine is a form of attention.",
  });
  await post(`/books/${bookId}/insights`, {
    text: "Routine is a form of attention.",
  });
  await post(`/books/${bookId}/insights`, {
    text: "The habit of looking matters more than the log.",
    kind: "quote",
    page: 31,
  });
};
