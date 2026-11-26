import {
  isPushServiceEndpoint,
  vapidPublicKeyToApplicationServerKey,
} from "./push.ts";

export type VapidConfig = {
  subject: string;
  publicKey: string;
  privateKey: string;
};

export type PushTarget = { endpoint: string; p256dh: string; auth: string };

export type PushOutcome = "sent" | "gone" | "failed";

const encoder = new TextEncoder();
const RECORD_SIZE = 4096;
const TOKEN_LIFETIME_SECONDS = 12 * 60 * 60;

const toBase64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

export const fromBase64Url = (value: string) => {
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};

type Bytes = Uint8Array<ArrayBuffer>;

const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
};

const hkdf = async (
  salt: Bytes,
  secret: Bytes,
  info: Bytes,
  length: number,
) => {
  const key = await crypto.subtle.importKey("raw", secret, "HKDF", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info },
    key,
    length * 8,
  );
  return new Uint8Array(bits);
};

export const encryptPayload = async (
  target: { p256dh: string; auth: string },
  payload: Bytes,
) => {
  const userAgentPublic = fromBase64Url(target.p256dh);
  const authSecret = fromBase64Url(target.auth);
  const userAgentKey = await crypto.subtle.importKey(
    "raw",
    userAgentPublic,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const pair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  );
  const serverPublic = new Uint8Array(
    await crypto.subtle.exportKey("raw", pair.publicKey),
  );
  const shared = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: userAgentKey },
      pair.privateKey,
      256,
    ),
  );
  const keyInfo = concat(
    encoder.encode("WebPush: info\0"),
    userAgentPublic,
    serverPublic,
  );
  const prk = await hkdf(authSecret, shared, keyInfo, 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const contentKey = await hkdf(
    salt,
    prk,
    encoder.encode("Content-Encoding: aes128gcm\0"),
    16,
  );
  const nonce = await hkdf(
    salt,
    prk,
    encoder.encode("Content-Encoding: nonce\0"),
    12,
  );
  const aesKey = await crypto.subtle.importKey(
    "raw",
    contentKey,
    "AES-GCM",
    false,
    ["encrypt"],
  );
  const record = concat(payload, Uint8Array.of(2));
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, record),
  );
  const header = new Uint8Array(21);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, RECORD_SIZE);
  header[20] = serverPublic.length;
  return concat(header, serverPublic, cipher);
};

const pemBody = (pem: string) =>
  fromBase64Url(
    pem
      .replace(/-----(BEGIN|END)[A-Z ]+-----/g, "")
      .replace(/\s+/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_"),
  );

const SEC1_PREFIX = [0x02, 0x01, 0x01, 0x04, 0x20];

const importSigningKey = async (config: VapidConfig) => {
  const applicationServerKey = vapidPublicKeyToApplicationServerKey(
    config.publicKey,
  );
  if (applicationServerKey === undefined) {
    throw new Error("VAPID public key is not a P-256 key");
  }
  const point = fromBase64Url(applicationServerKey);
  const der = pemBody(config.privateKey);
  const algorithm = { name: "ECDSA", namedCurve: "P-256" };
  if (config.privateKey.includes("EC PRIVATE KEY")) {
    if (!SEC1_PREFIX.every((byte, index) => der[2 + index] === byte)) {
      throw new Error("VAPID private key is not a P-256 SEC1 key");
    }
    const key = await crypto.subtle.importKey(
      "jwk",
      {
        kty: "EC",
        crv: "P-256",
        d: toBase64Url(der.slice(7, 39)),
        x: toBase64Url(point.slice(1, 33)),
        y: toBase64Url(point.slice(33, 65)),
      },
      algorithm,
      false,
      ["sign"],
    );
    return { key, applicationServerKey };
  }
  const key = await crypto.subtle.importKey("pkcs8", der, algorithm, false, [
    "sign",
  ]);
  return { key, applicationServerKey };
};

export const vapidHeader = async (
  config: VapidConfig,
  endpoint: string,
  nowMs: number,
) => {
  const { key, applicationServerKey } = await importSigningKey(config);
  const part = (value: unknown) =>
    toBase64Url(encoder.encode(JSON.stringify(value)));
  const unsigned = `${part({ typ: "JWT", alg: "ES256" })}.${part({
    aud: new URL(endpoint).origin,
    exp: Math.floor(nowMs / 1000) + TOKEN_LIFETIME_SECONDS,
    sub: config.subject,
  })}`;
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      encoder.encode(unsigned),
    ),
  );
  return `vapid t=${unsigned}.${toBase64Url(signature)}, k=${applicationServerKey}`;
};

export const sendWebPush = async (
  deps: { fetch: typeof fetch; now: () => number; vapid: VapidConfig },
  target: PushTarget,
  payload: unknown,
) => {
  if (!isPushServiceEndpoint(target.endpoint)) {
    return "gone" satisfies PushOutcome;
  }
  const body = await encryptPayload(
    target,
    encoder.encode(JSON.stringify(payload)),
  );
  const response = await deps.fetch(target.endpoint, {
    method: "POST",
    redirect: "manual",
    headers: {
      authorization: await vapidHeader(deps.vapid, target.endpoint, deps.now()),
      "content-encoding": "aes128gcm",
      "content-type": "application/octet-stream",
      ttl: "43200",
      urgency: "normal",
    },
    body,
  });
  await response.body?.cancel();
  if (response.ok) {
    return "sent" satisfies PushOutcome;
  }
  return response.status === 404 || response.status === 410
    ? ("gone" satisfies PushOutcome)
    : ("failed" satisfies PushOutcome);
};
