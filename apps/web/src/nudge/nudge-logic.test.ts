import { describe, expect, it } from "vitest";
import {
  isNudgeTime,
  isSilencedToday,
  keyToBytes,
  pushState,
  subscriptionBody,
  todayIn,
  type PushEnvironment,
} from "./nudge-logic.ts";

const desktop: PushEnvironment = {
  hasServiceWorker: true,
  hasPushManager: true,
  hasNotification: true,
  permission: "default",
  isIos: false,
  isStandalone: false,
};

describe("pushState", () => {
  it("is ready where push works", () => {
    expect(pushState(desktop)).toBe("ready");
  });

  it("asks an iPhone browser tab to add the app to the home screen", () => {
    expect(pushState({ ...desktop, isIos: true, hasPushManager: false })).toBe(
      "needs-install",
    );
  });

  it("is ready on an iPhone once the app is installed", () => {
    expect(pushState({ ...desktop, isIos: true, isStandalone: true })).toBe(
      "ready",
    );
  });

  it("reports a blocked permission", () => {
    expect(pushState({ ...desktop, permission: "denied" })).toBe("denied");
  });

  it("reports a browser without push", () => {
    expect(pushState({ ...desktop, hasPushManager: false })).toBe(
      "unsupported",
    );
  });
});

describe("isNudgeTime", () => {
  it("accepts HH:MM and refuses the rest", () => {
    expect(isNudgeTime("20:30")).toBe(true);
    expect(isNudgeTime("00:00")).toBe(true);
    expect(isNudgeTime("25:00")).toBe(false);
    expect(isNudgeTime("")).toBe(false);
    expect(isNudgeTime("8:30")).toBe(false);
  });
});

describe("isSilencedToday", () => {
  const now = new Date("2026-11-26T23:30:00Z");

  it("finds the date in the user's time zone", () => {
    expect(todayIn("Europe/London", now)).toBe("2026-11-26");
    expect(todayIn("Asia/Tokyo", now)).toBe("2026-11-27");
  });

  it("is silenced through the date it names", () => {
    expect(isSilencedToday("2026-11-26", "Europe/London", now)).toBe(true);
  });

  it("stops being silenced the next day", () => {
    expect(isSilencedToday("2026-11-26", "Asia/Tokyo", now)).toBe(false);
  });

  it("is not silenced without a date", () => {
    expect(isSilencedToday(null, "Europe/London", now)).toBe(false);
  });
});

describe("keyToBytes", () => {
  it("decodes base64url", () => {
    expect(Array.from(keyToBytes("AQID_w"))).toEqual([1, 2, 3, 255]);
  });
});

describe("subscriptionBody", () => {
  it("keeps the endpoint and both keys", () => {
    expect(
      subscriptionBody({
        endpoint: "https://push.example.test/a",
        keys: { p256dh: "k1", auth: "k2" },
      }),
    ).toEqual({
      endpoint: "https://push.example.test/a",
      keys: { p256dh: "k1", auth: "k2" },
    });
  });

  it("refuses a subscription without keys", () => {
    expect(
      subscriptionBody({ endpoint: "https://push.example.test/a" }),
    ).toBeNull();
  });
});
