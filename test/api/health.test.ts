import { describe, expect, it } from "vitest";
import { call, expectMatchesContract } from "./harness.ts";

describe("GET /v1/health", () => {
  it("returns ok and a request id, matching the contract", async () => {
    const response = await call("/health");
    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toBeTruthy();
    expect(await expectMatchesContract(response, "GET", "/health")).toEqual({
      status: "ok",
    });
  });

  it("rejects a request without the gateway secret", async () => {
    const response = await call("/health", {
      headers: { "x-gateway-secret": "wrong" },
    });
    expect(response.status).toBe(403);
    expect(response.headers.get("content-type")).toContain(
      "application/problem+json",
    );
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe("gateway_rejected");
  });

  it("returns a problem for an unknown path", async () => {
    const response = await call("/nope");
    expect(response.status).toBe(404);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe("not_found");
  });
});
