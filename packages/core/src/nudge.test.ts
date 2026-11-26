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
      endpoint: "https://fcm.googleapis.com/fcm/send/x",
      keys: { p256dh: "a", auth: "b" },
    };
    expect(parsePushSubscription(good)).toEqual({
      ok: true,
      subscription: { endpoint: good.endpoint, p256dh: "a", auth: "b" },
    });
    expect(
      parsePushSubscription({
        ...good,
        endpoint: "http://fcm.googleapis.com/fcm/send/x",
      }).ok,
    ).toBe(false);
    expect(parsePushSubscription({ endpoint: good.endpoint }).ok).toBe(false);
    for (const endpoint of [
      "https://push.example.test/x",
      "https://169.254.169.254/latest/meta-data",
      "https://localhost/x",
      "https://fcm.googleapis.com.evil.test/x",
      "https://user:pass@fcm.googleapis.com/x",
      "https://fcm.googleapis.com:8443/x",
      "https://evilpush.apple.com/x",
    ]) {
      expect(parsePushSubscription({ ...good, endpoint }).ok).toBe(false);
    }
    for (const endpoint of [
      "https://updates.push.services.mozilla.com/wpush/v2/x",
      "https://web.push.apple.com/x",
      "https://wns2-par02p.notify.windows.com/w/?token=x",
    ]) {
      expect(parsePushSubscription({ ...good, endpoint }).ok).toBe(true);
    }
    expect(
      parsePushSubscription({ ...good, keys: { p256dh: "", auth: "b" } }).ok,
    ).toBe(false);
    expect(parseEndpointQuery("https://fcm.googleapis.com/fcm/send/x")).toBe(
      "https://fcm.googleapis.com/fcm/send/x",
    );
    expect(parseEndpointQuery("nope")).toBeUndefined();
    expect(parseEndpointQuery(undefined)).toBeUndefined();
  });
});
