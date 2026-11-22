import { beforeAll, describe, expect, it } from "vitest";
import { sessionTokenFor } from "./clerk.ts";
import { call, expectMatchesContract } from "./harness.ts";

let token: string;

beforeAll(async () => {
  token = (await sessionTokenFor("bt-test-alice")).token;
});

describe("GET /v1/push/public-key", () => {
  it("returns 401 without a token", async () => {
    const response = await call("/push/public-key");
    expect(response.status).toBe(401);
    await expectMatchesContract(response, "GET", "/push/public-key");
  });

  it("returns the key as base64url of a 65-byte uncompressed point", async () => {
    const response = await call("/push/public-key", {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.status).toBe(200);
    const body = (await expectMatchesContract(
      response,
      "GET",
      "/push/public-key",
    )) as { publicKey: string };
    expect(body.publicKey).toMatch(/^B[A-Za-z0-9_-]{86}$/);
    const bytes = Buffer.from(body.publicKey, "base64url");
    expect(bytes).toHaveLength(65);
    expect(bytes[0]).toBe(0x04);
  });
});
