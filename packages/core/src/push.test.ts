import { describe, expect, it } from "vitest";
import { vapidPublicKeyToApplicationServerKey } from "./push.ts";

const generate = async () => {
  const pair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  const spki = new Uint8Array(
    await crypto.subtle.exportKey("spki", pair.publicKey),
  );
  const raw = new Uint8Array(
    await crypto.subtle.exportKey("raw", pair.publicKey),
  );
  return { spki, raw };
};

const base64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const base64Url = (bytes: Uint8Array) =>
  base64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

describe("vapidPublicKeyToApplicationServerKey", () => {
  it("converts a PEM public key to base64url of the uncompressed point", async () => {
    const { spki, raw } = await generate();
    const pem = `-----BEGIN PUBLIC KEY-----\n${base64(spki).replace(/(.{64})/g, "$1\n")}\n-----END PUBLIC KEY-----\n`;
    const result = vapidPublicKeyToApplicationServerKey(pem);
    expect(result).toBe(base64Url(raw));
    expect(result).toHaveLength(87);
    expect(result?.startsWith("B")).toBe(true);
  });

  it("accepts the bare base64 body and an already converted key", async () => {
    const { spki, raw } = await generate();
    expect(vapidPublicKeyToApplicationServerKey(base64(spki))).toBe(
      base64Url(raw),
    );
    expect(vapidPublicKeyToApplicationServerKey(base64Url(raw))).toBe(
      base64Url(raw),
    );
  });

  it("rejects empty, malformed and wrong-length input", () => {
    expect(vapidPublicKeyToApplicationServerKey("")).toBeUndefined();
    expect(vapidPublicKeyToApplicationServerKey("!!!")).toBeUndefined();
    expect(vapidPublicKeyToApplicationServerKey("AAAA")).toBeUndefined();
  });
});
