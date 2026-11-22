import { describe, expect, it } from "vitest";
import { LOG_SESSION_PATH, NUDGE_PAYLOAD } from "./nudge-sender.ts";

describe("NUDGE_PAYLOAD", () => {
  it("holds only a title and the Log session link", () => {
    expect(Object.keys(NUDGE_PAYLOAD).toSorted()).toEqual(["title", "url"]);
    expect(NUDGE_PAYLOAD.url).toBe(LOG_SESSION_PATH);
  });
});
