import { describe, expect, it } from "vitest";
import {
  freshestVerification,
  isRecentlyVerified,
  parseMeDelete,
  retryUntilDone,
} from "./account.ts";

describe("account deletion rules", () => {
  it("needs exactly the confirmation word", () => {
    expect(parseMeDelete({ confirmation: "delete" }).ok).toBe(true);
    for (const bad of [
      null,
      [],
      {},
      { confirmation: "Delete" },
      { confirmation: "yes" },
      { confirmation: "delete", extra: 1 },
    ]) {
      expect(parseMeDelete(bad).ok).toBe(false);
    }
  });

  it("accepts a verification up to 10 minutes old and refuses older or missing ones", () => {
    expect(isRecentlyVerified(0)).toBe(true);
    expect(isRecentlyVerified(10)).toBe(true);
    expect(isRecentlyVerified(11)).toBe(false);
    expect(isRecentlyVerified(undefined)).toBe(false);
    expect(isRecentlyVerified(-1)).toBe(false);
  });

  it("reads the freshest factor age from the Clerk fva claim", () => {
    expect(freshestVerification([3, -1])).toBe(3);
    expect(freshestVerification([30, 4])).toBe(4);
    expect(freshestVerification([-1, -1])).toBeUndefined();
    expect(freshestVerification(undefined)).toBeUndefined();
    expect(freshestVerification("5")).toBeUndefined();
  });

  it("retries a failing step until it works, then stops", async () => {
    let calls = 0;
    const waits: number[] = [];
    await retryUntilDone(
      async () => {
        calls += 1;
        if (calls < 3) {
          throw new Error("down");
        }
      },
      [1, 2, 3],
      async (ms) => {
        waits.push(ms);
      },
    );
    expect(calls).toBe(3);
    expect(waits).toEqual([1, 2]);
  });

  it("gives up with the last error after the last delay", async () => {
    await expect(
      retryUntilDone(
        () => Promise.reject(new Error("still down")),
        [1],
        async () => {},
      ),
    ).rejects.toThrow("still down");
  });
});
