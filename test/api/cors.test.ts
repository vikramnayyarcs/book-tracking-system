import { describe, expect, it } from "vitest";
import {
  groqSpeech,
  groqText,
  groqVision,
} from "../../packages/core/src/ai/index.ts";
import {
  clerkVerifier,
  createApp,
  createDb,
  jsonLogger,
} from "../../packages/core/src/api/index.ts";

const webOrigin = "https://web-dev-test.pages.dev";
const gatewaySecret = "cors-test-gateway-secret";
const unused = () => Promise.reject(new Error("not used by these routes"));

const app = createApp({
  allowedOrigins: [webOrigin],
  gatewaySecret,
  jobsSecret: "unused",
  logger: jsonLogger(() => undefined),
  newRequestId: () => crypto.randomUUID(),
  now: () => Date.now(),
  verifyToken: clerkVerifier("http://127.0.0.1:9"),
  db: createDb(process.env["DATABASE_URL"] ?? ""),
  defaultTier: "plus",
  objects: { download: unused, remove: unused, signedUploadUrl: unused },
  fetch: (input, init) => fetch(input, init),
  openLibraryUrl: "http://127.0.0.1:9",
  vapidPublicKey: "",
  vapidPrivateKey: "",
  vapidSubject: "",
  embedder: { embed: unused },
  speech: groqSpeech({ apiKey: "test" }),
  text: groqText({ apiKey: "test", model: "recorded" }),
  vision: groqVision({ apiKey: "test", model: "recorded" }),
  waitUntil: () => undefined,
});

const preflight = (origin: string) =>
  app.fetch(
    new Request("http://api.test/v1/books", {
      method: "OPTIONS",
      headers: {
        origin,
        "access-control-request-method": "POST",
        "access-control-request-headers": "authorization, content-type",
        "x-gateway-secret": gatewaySecret,
      },
    }),
  );

describe("CORS", () => {
  it("answers the browser's preflight from the web app", async () => {
    const response = await preflight(webOrigin);
    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe(webOrigin);
    expect(
      response.headers.get("access-control-allow-headers")?.toLowerCase(),
    ).toContain("authorization");
    expect(response.headers.get("access-control-allow-methods")).toContain(
      "POST",
    );
  });

  it("does not allow other origins", async () => {
    const response = await preflight("https://evil.example");
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("lets the web app read the response and the request id", async () => {
    const response = await app.fetch(
      new Request("http://api.test/v1/health", {
        headers: { origin: webOrigin, "x-gateway-secret": gatewaySecret },
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe(webOrigin);
    expect(response.headers.get("access-control-expose-headers")).toContain(
      "x-request-id",
    );
  });

  it("adds CORS headers to errors too, so the web app can show them", async () => {
    const response = await app.fetch(
      new Request("http://api.test/v1/books", {
        headers: { origin: webOrigin, "x-gateway-secret": gatewaySecret },
      }),
    );
    expect(response.status).toBe(401);
    expect(response.headers.get("access-control-allow-origin")).toBe(webOrigin);
  });
});
