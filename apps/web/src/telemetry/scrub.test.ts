import type { TransportItem } from "@grafana/faro-web-sdk";
import { describe, expect, it } from "vitest";
import { routePattern, scrubItem } from "./scrub.ts";

const seededNote = "Gandalf said the bridge of Khazad-dum falls at dawn";

function item(type: string, payload: object, extraMeta = {}) {
  return {
    type,
    payload,
    meta: {
      app: { name: "web" },
      session: { id: "s1", attributes: { note: seededNote } },
      user: {
        id: "user_1",
        email: "alice@example.invalid",
        username: seededNote,
      },
      page: {
        id: "p1",
        url: `https://app.example.invalid/books/b1/log?draft=${encodeURIComponent(seededNote)}`,
        attributes: { draft: seededNote },
      },
      view: { name: "/books/:bookId/log" },
      ...extraMeta,
    },
  } as unknown as TransportItem;
}

const hostile: TransportItem[] = [
  item("exception", {
    timestamp: "t",
    type: "Error",
    value: `Failed to save: ${seededNote}`,
    context: { note: seededNote },
    stacktrace: {
      frames: [
        {
          filename: `https://app.example.invalid/assets/app.js?note=${seededNote}`,
          function: "save",
        },
      ],
    },
  }),
  item("measurement", {
    timestamp: "t",
    type: "web-vitals",
    values: { lcp: 1200 },
    context: { rating: "good", note: seededNote, id: seededNote },
  }),
  item("measurement", {
    timestamp: "t",
    type: "custom",
    values: { x: 1 },
    context: { note: seededNote },
  }),
  item("event", {
    timestamp: "t",
    name: "faro.navigation",
    attributes: { url: seededNote, duration: "12" },
  }),
  item("event", { timestamp: "t", name: seededNote, attributes: {} }),
  item("log", { timestamp: "t", message: seededNote, level: "info" }),
  item("trace", { resourceSpans: [{ note: seededNote }] }),
];

describe("scrubItem", () => {
  it("never lets seeded note text into any captured field", () => {
    const out = hostile.map(scrubItem);
    expect(JSON.stringify(out)).not.toContain("Gandalf");
    expect(JSON.stringify(out)).not.toContain("Khazad");
    expect(JSON.stringify(out)).not.toContain("alice@example.invalid");
  });

  it("keeps errors, Web Vitals and navigation timings, with the route pattern", () => {
    const out = hostile.map(scrubItem);
    expect(out.map((o) => o?.type ?? null)).toEqual([
      "exception",
      "measurement",
      null,
      "event",
      null,
      null,
      null,
    ]);
    expect(out[0]?.meta.page?.url).toBe("/books/:bookId/log");
    expect(out[0]?.meta.user).toBeUndefined();
    expect(out[3]?.payload).toMatchObject({ attributes: { duration: "12" } });
    expect(out[1]?.payload).toMatchObject({
      context: { rating: "good" },
      values: { lcp: 1200 },
    });
  });
});

describe("routePattern", () => {
  it("turns route params into placeholders", () => {
    expect(routePattern("/books/$bookId/log")).toBe("/books/:bookId/log");
    expect(routePattern("/")).toBe("/");
  });
});
