import { describe, expect, it } from "vitest";
import {
  generateToken,
  hasScope,
  hashToken,
  isPersonalToken,
  parseTokenCreate,
} from "./tokens.ts";

describe("tokens", () => {
  it("makes distinct prefixed secrets that are not Clerk JWTs", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).not.toBe(b);
    expect(isPersonalToken(a)).toBe(true);
    expect(a).toMatch(/^btp_[A-Za-z0-9_-]{43}$/);
    expect(isPersonalToken("eyJhbGciOi.a.b")).toBe(false);
  });

  it("hashes to the SHA-256 hex of the secret", async () => {
    expect(await hashToken("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("lets a Clerk caller through and checks a token's scopes", () => {
    expect(hasScope(undefined, "books:read")).toBe(true);
    expect(hasScope(["books:read"], "books:read")).toBe(true);
    expect(hasScope(["books:read"], "sessions:write")).toBe(false);
  });

  it("accepts a name with known scopes", () => {
    expect(
      parseTokenCreate({ name: "iOS Shortcut", scopes: ["sessions:write"] }),
    ).toEqual({ ok: true, name: "iOS Shortcut", scopes: ["sessions:write"] });
  });

  it("rejects bad bodies", () => {
    const bad: unknown[] = [
      null,
      [],
      {},
      { name: "", scopes: ["books:read"] },
      { name: "x".repeat(81), scopes: ["books:read"] },
      { name: "x", scopes: [] },
      { name: "x", scopes: ["admin"] },
      { name: "x", scopes: ["books:read", "books:read"] },
      { name: "x", scopes: ["books:read"], extra: 1 },
    ];
    for (const body of bad) {
      expect(parseTokenCreate(body).ok).toBe(false);
    }
  });
});
