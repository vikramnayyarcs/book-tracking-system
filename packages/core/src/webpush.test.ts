import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  encryptPayload,
  fromBase64Url,
  sendWebPush,
  vapidHeader,
} from "./webpush.ts";

type Bytes = Uint8Array<ArrayBuffer>;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const toBase64Url = (bytes: Uint8Array) =>
  toBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const pem = (label: string, der: Uint8Array) =>
  `-----BEGIN ${label}-----\n${toBase64(der)}\n-----END ${label}-----\n`;

const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
};

const SEC1_START = [0x30, 0x6b, 0x02, 0x01, 0x01, 0x04, 0x20];

const vapidKeys = async (privateFormat: "sec1" | "pkcs8") => {
  const pair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  const spki = new Uint8Array(
    await crypto.subtle.exportKey("spki", pair.publicKey),
  );
  const pkcs8 = new Uint8Array(
    await crypto.subtle.exportKey("pkcs8", pair.privateKey),
  );
  const start = pkcs8.findIndex((_, index) =>
    SEC1_START.every((byte, step) => pkcs8[index + step] === byte),
  );
  return {
    verifyKey: pair.publicKey,
    publicKey: pem("PUBLIC KEY", spki),
    privateKey:
      privateFormat === "pkcs8"
        ? pem("PRIVATE KEY", pkcs8)
        : pem("EC PRIVATE KEY", pkcs8.slice(start)),
  };
};

const subscriber = async () => {
  const pair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  );
  const publicKey = new Uint8Array(
    await crypto.subtle.exportKey("raw", pair.publicKey),
  );
  const auth = crypto.getRandomValues(new Uint8Array(16));
  return {
    pair,
    publicKey,
    auth,
    target: (endpoint: string) => ({
      endpoint,
      p256dh: toBase64Url(publicKey),
      auth: toBase64Url(auth),
    }),
  };
};

const derive = async (
  salt: Bytes,
  secret: Bytes,
  info: string | Bytes,
  length: number,
) => {
  const key = await crypto.subtle.importKey("raw", secret, "HKDF", false, [
    "deriveBits",
  ]);
  return new Uint8Array(
    await crypto.subtle.deriveBits(
      {
        name: "HKDF",
        hash: "SHA-256",
        salt,
        info: typeof info === "string" ? encoder.encode(info) : info,
      },
      key,
      length * 8,
    ),
  );
};

const decrypt = async (
  body: Uint8Array,
  ua: Awaited<ReturnType<typeof subscriber>>,
) => {
  const salt = body.slice(0, 16);
  const recordSize = new DataView(body.buffer, body.byteOffset).getUint32(16);
  const idLength = body[20] ?? 0;
  const serverPublic = body.slice(21, 21 + idLength);
  const cipher = body.slice(21 + idLength);
  const serverKey = await crypto.subtle.importKey(
    "raw",
    serverPublic,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const shared = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: serverKey },
      ua.pair.privateKey,
      256,
    ),
  );
  const prk = await derive(
    ua.auth,
    shared,
    concat(encoder.encode("WebPush: info\0"), ua.publicKey, serverPublic),
    32,
  );
  const contentKey = await derive(
    salt,
    prk,
    "Content-Encoding: aes128gcm\0",
    16,
  );
  const nonce = await derive(salt, prk, "Content-Encoding: nonce\0", 12);
  const aesKey = await crypto.subtle.importKey(
    "raw",
    contentKey,
    "AES-GCM",
    false,
    ["decrypt"],
  );
  const record = new Uint8Array(
    await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, aesKey, cipher),
  );
  return { record, recordSize };
};

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const now = Date.parse("2026-11-22T10:00:00Z");

describe("encryptPayload", () => {
  it("produces an RFC 8291 aes128gcm body only the subscriber can read", async () => {
    const ua = await subscriber();
    const body = await encryptPayload(
      ua.target("https://push.example.test/x"),
      encoder.encode(JSON.stringify({ title: "Hello", url: "/log" })),
    );
    const { record, recordSize } = await decrypt(body, ua);
    expect(recordSize).toBe(4096);
    expect(body[20]).toBe(65);
    expect(record.at(-1)).toBe(2);
    expect(JSON.parse(decoder.decode(record.slice(0, -1)))).toEqual({
      title: "Hello",
      url: "/log",
    });
  });
});

describe("sendWebPush", () => {
  for (const format of ["sec1", "pkcs8"] as const) {
    it(`sends an aes128gcm body with an RFC 8292 header signed by a ${format} private key`, async () => {
      const keys = await vapidKeys(format);
      const vapid = {
        subject: "https://example.invalid",
        publicKey: keys.publicKey,
        privateKey: keys.privateKey,
      };
      const ua = await subscriber();
      let seen: { headers: Headers; length: number } | undefined;
      server.use(
        http.post("https://push.example.test/send/1", async ({ request }) => {
          seen = {
            headers: request.headers,
            length: (await request.arrayBuffer()).byteLength,
          };
          return new HttpResponse(null, { status: 201 });
        }),
      );
      const outcome = await sendWebPush(
        { fetch, now: () => now, vapid },
        ua.target("https://push.example.test/send/1"),
        { title: "Hello", url: "/log" },
      );
      expect(outcome).toBe("sent");
      const { headers, length } = seen as NonNullable<typeof seen>;
      expect(headers.get("content-encoding")).toBe("aes128gcm");
      expect(headers.get("ttl")).toBe("43200");
      expect(length).toBeGreaterThan(21 + 65 + 16);

      const match = /^vapid t=([^,]+), k=(.+)$/.exec(
        headers.get("authorization") ?? "",
      );
      const [, token = "", key = ""] = match ?? [];
      const [header = "", claims = "", signature = ""] = token.split(".");
      expect(JSON.parse(decoder.decode(fromBase64Url(header)))).toEqual({
        typ: "JWT",
        alg: "ES256",
      });
      expect(JSON.parse(decoder.decode(fromBase64Url(claims)))).toEqual({
        aud: "https://push.example.test",
        exp: now / 1000 + 43200,
        sub: "https://example.invalid",
      });
      expect(
        await crypto.subtle.verify(
          { name: "ECDSA", hash: "SHA-256" },
          keys.verifyKey,
          fromBase64Url(signature),
          encoder.encode(`${header}.${claims}`),
        ),
      ).toBe(true);
      expect(fromBase64Url(key)).toHaveLength(65);
    });
  }

  it("reports 404 and 410 as gone and other errors as failed", async () => {
    const keys = await vapidKeys("sec1");
    const vapid = {
      subject: "https://example.invalid",
      publicKey: keys.publicKey,
      privateKey: keys.privateKey,
    };
    const ua = await subscriber();
    server.use(
      http.post(
        "https://push.example.test/404",
        () => new HttpResponse(null, { status: 404 }),
      ),
      http.post(
        "https://push.example.test/410",
        () => new HttpResponse(null, { status: 410 }),
      ),
      http.post(
        "https://push.example.test/500",
        () => new HttpResponse(null, { status: 500 }),
      ),
    );
    const send = (path: string) =>
      sendWebPush(
        { fetch, now: () => now, vapid },
        ua.target(`https://push.example.test/${path}`),
        { title: "t", url: "/log" },
      );
    expect(await send("404")).toBe("gone");
    expect(await send("410")).toBe("gone");
    expect(await send("500")).toBe("failed");
  });

  it("refuses a public key that is not P-256", async () => {
    await expect(
      vapidHeader(
        {
          subject: "https://example.invalid",
          publicKey: "abc",
          privateKey: "",
        },
        "https://push.example.test/x",
        now,
      ),
    ).rejects.toThrow("not a P-256 key");
  });
});
