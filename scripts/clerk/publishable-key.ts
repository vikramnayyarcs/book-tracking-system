import { fileURLToPath } from "node:url";

export function checkPublishableKey(
  publishableKey: string,
  frontendApiUrl: string,
) {
  if (publishableKey === "") {
    return ["The publishable key is empty."];
  }
  if (!publishableKey.startsWith("pk_test_")) {
    return ["The dev build needs a key that starts with pk_test_."];
  }
  const decoded = Buffer.from(
    publishableKey.slice("pk_test_".length),
    "base64",
  ).toString("utf8");
  if (!/^[a-z0-9.-]+\$$/.test(decoded)) {
    return ["The publishable key does not decode to a Clerk host."];
  }
  const keyHost = decoded.slice(0, -1);
  const instanceHost = new URL(frontendApiUrl).host;
  if (keyHost !== instanceHost) {
    return [
      `The publishable key is for ${keyHost}, a different Clerk instance than ${instanceHost}.`,
    ];
  }
  return [];
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const key = process.env["DEV_CLERK_PUBLISHABLE_KEY"] ?? "";
  const url = process.env["DEV_CLERK_FRONTEND_API_URL"] ?? "";
  if (url === "") {
    console.error("Set DEV_CLERK_FRONTEND_API_URL.");
    process.exit(2);
  }
  const findings = checkPublishableKey(key, url);
  for (const finding of findings) console.error(`::error::${finding}`);
  if (findings.length > 0) process.exit(1);
  console.log("The publishable key matches the Clerk frontend API URL.");
}
