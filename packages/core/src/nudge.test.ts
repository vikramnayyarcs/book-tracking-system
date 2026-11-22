import { describe, expect, it } from "vitest";
import {
  isTimeZone,
  localDate,
  parseEndpointQuery,
  parseMeUpdate,
  parsePushSubscription,
} from "./nudge.ts";

describe("nudge settings", () => {
  it("accepts real IANA zones only", () => {
    expect(isTimeZone("Europe/London")).toBe(true);
    expect(isTimeZone("UTC")).toBe(true);
    expect(isTimeZone("Mars/Olympus")).toBe(false);
    expect(isTimeZone("")).toBe(false);
  });

  it("finds the local date in the user's zone", () => {
    const at = Date.UTC(2026, 10, 21, 23, 30);
    expect(localDate(at, "UTC")).toBe("2026-11-21");
    expect(localDate(at, "Pacific/Auckland")).toBe("2026-11-22");
    expect(localDate(at, "America/Los_Angeles")).toBe("2026-11-21");
  });

  it("parses updates and rejects bad ones", () => {
    expect(parseMeUpdate({ nudgeTime: "20:30" })).toEqual({
      ok: true,
      update: { nudgeTime: "20:30" },
    });
    expect(parseMeUpdate({ nudgeTime: null })).toEqual({
      ok: true,
      update: { nudgeTime: null },
    });
    expect(parseMeUpdate({ notReadingToday: true }).ok).toBe(true);
    for (const bad of [
      undefined,
      [],
      {},
      { nudgeTime: "24:00" },
      { nudgeTime: "8:30" },
      { nudgeTime: 5 },
      { timeZone: "Nope/Zone" },
      { notReadingToday: "yes" },
      { tier: "plus" },
    ]) {
      expect(parseMeUpdate(bad).ok).toBe(false);
    }
  });

  it("parses push subscriptions", () => {
    const good = {
      endpoint: "https://push.example.test/x",
      keys: { p256dh: "a", auth: "b" },
    };
    expect(parsePushSubscription(good)).toEqual({
      ok: true,
      subscription: { endpoint: good.endpoint, p256dh: "a", auth: "b" },
    });
    expect(
      parsePushSubscription({ ...good, endpoint: "http://push.example.test" })
        .ok,
    ).toBe(false);
    expect(parsePushSubscription({ endpoint: good.endpoint }).ok).toBe(false);
    expect(
      parsePushSubscription({ ...good, keys: { p256dh: "", auth: "b" } }).ok,
    ).toBe(false);
    expect(parseEndpointQuery("https://push.example.test/x")).toBe(
      "https://push.example.test/x",
    );
    expect(parseEndpointQuery("nope")).toBeUndefined();
    expect(parseEndpointQuery(undefined)).toBeUndefined();
  });
});
