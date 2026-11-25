import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const file = readFileSync(
  new URL("../public/_headers", import.meta.url),
  "utf8",
);

const headers: Record<string, string> = {};
for (const line of file.split("\n")) {
  if (!line.startsWith("  ")) continue;
  const [name = "", ...rest] = line.trim().split(": ");
  headers[name] = rest.join(": ");
}

const directives: Record<string, string[]> = {};
for (const part of (headers["Content-Security-Policy"] ?? "").split("; ")) {
  const [name = "", ...sources] = part.split(" ");
  directives[name] = sources;
}

describe("_headers", () => {
  it("applies to every path", () => {
    expect(file.startsWith("/*\n")).toBe(true);
  });

  it("forbids framing, referrers and unneeded browser features", () => {
    expect(directives["frame-ancestors"]).toEqual(["'none'"]);
    expect(headers["Referrer-Policy"]).toBe("no-referrer");
    expect(headers["Strict-Transport-Security"]).toMatch(/^max-age=\d{8,}/);
    expect(headers["Permissions-Policy"]).toContain("camera=(self)");
    expect(headers["Permissions-Policy"]).toContain("microphone=(self)");
    expect(headers["Permissions-Policy"]).toContain("geolocation=()");
  });

  it("allows scripts only from the app, Clerk and its bot check", () => {
    expect(directives["default-src"]).toEqual(["'none'"]);
    expect(directives["script-src"]).not.toContain("'unsafe-inline'");
    expect(directives["script-src"]).not.toContain("'unsafe-eval'");
    for (const source of directives["script-src"] ?? []) {
      expect([
        "'self'",
        "'wasm-unsafe-eval'",
        "https://*.clerk.accounts.dev",
        "https://challenges.cloudflare.com",
        "https://*.protect.clerk.com",
      ]).toContain(source);
    }
  });

  it("allows Clerk's abuse and fraud protection hosts", () => {
    expect(directives["script-src"]).toContain("https://*.protect.clerk.com");
    expect(directives["frame-src"]).toContain("https://*.protect.clerk.com");
    expect(directives["connect-src"]).toContain(
      "https://*.protect.clerk.com:*",
    );
  });
});
