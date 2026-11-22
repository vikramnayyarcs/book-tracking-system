const SPKI_P256_PREFIX = [
  0x30, 0x59, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01,
  0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, 0x03, 0x42, 0x00,
];
const POINT_LENGTH = 65;

const fromBase64 = (value: string) => {
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};

const toBase64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

export const vapidPublicKeyToApplicationServerKey = (publicKey: string) => {
  const body = publicKey
    .replace(/-----(BEGIN|END) PUBLIC KEY-----/g, "")
    .replace(/\s+/g, "");
  if (body === "") {
    return undefined;
  }
  let bytes: Uint8Array;
  try {
    bytes = fromBase64(body);
  } catch {
    return undefined;
  }
  let point: Uint8Array;
  if (bytes.length === POINT_LENGTH) {
    point = bytes;
  } else if (
    bytes.length === SPKI_P256_PREFIX.length + POINT_LENGTH &&
    SPKI_P256_PREFIX.every((byte, index) => bytes[index] === byte)
  ) {
    point = bytes.slice(SPKI_P256_PREFIX.length);
  } else {
    return undefined;
  }
  return point[0] === 0x04 ? toBase64Url(point) : undefined;
};
