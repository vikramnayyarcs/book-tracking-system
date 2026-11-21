import { createHash, createHmac, createSign } from "node:crypto";
import { expiryReason, toResult } from "./expiry.ts";

type Env = Record<string, string | undefined>;

const notSet = (name: string) => toResult(name, "not set");

const call = async (url: string, headers: Record<string, string>) => {
  const response = await fetch(url, { headers });
  const text = await response.text();
  let body: unknown = undefined;
  try {
    body = JSON.parse(text);
  } catch {
    body = undefined;
  }
  return { status: response.status, body };
};

const rejected = (status: number) =>
  status >= 200 && status < 300 ? undefined : `rejected (${status})`;

const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

export const checkCloudflare = async (env: Env, now: Date) => {
  const name = "CLOUDFLARE_API_TOKEN";
  const token = env["CLOUDFLARE_API_TOKEN"];
  if (!token) return notSet(name);
  const base = "https://api.cloudflare.com/client/v4";
  const accountId = env["CLOUDFLARE_ACCOUNT_ID"];
  let result = await call(`${base}/user/tokens/verify`, bearer(token));
  if (result.status >= 400 && accountId) {
    result = await call(
      `${base}/accounts/${accountId}/tokens/verify`,
      bearer(token),
    );
  }
  const failure = rejected(result.status);
  if (failure) return toResult(name, failure);
  const payload = result.body as {
    result?: { status?: string; expires_on?: string };
  };
  if (payload.result?.status !== "active") return toResult(name, "not active");
  return toResult(name, expiryReason(payload.result.expires_on, now));
};

const base64url = (input: Buffer | string) =>
  Buffer.from(input).toString("base64url");

export const checkGithubApp = async (env: Env) => {
  const name = "TF_GITHUB_APP_PRIVATE_KEY";
  const key = env["TF_GITHUB_APP_PRIVATE_KEY"];
  const appId = env["TF_GITHUB_APP_ID"];
  if (!key || !appId) return notSet(name);
  const issuedAt = Math.floor(Date.now() / 1000);
  const unsigned = `${base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${base64url(
    JSON.stringify({ iat: issuedAt - 60, exp: issuedAt + 300, iss: appId }),
  )}`;
  let jwt: string;
  try {
    jwt = `${unsigned}.${base64url(createSign("RSA-SHA256").update(unsigned).sign(key))}`;
  } catch {
    return toResult(name, "private key unreadable");
  }
  const result = await call("https://api.github.com/app", {
    ...bearer(jwt),
    accept: "application/vnd.github+json",
    "user-agent": "key-check",
  });
  return toResult(name, rejected(result.status));
};

const sha256 = (data: string) =>
  createHash("sha256").update(data).digest("hex");
const hmac = (key: Buffer | string, data: string) =>
  createHmac("sha256", key).update(data).digest();

export const checkR2State = async (env: Env, now: Date) => {
  const name = "TF_STATE_R2_ACCESS_KEY_ID, TF_STATE_R2_SECRET_ACCESS_KEY";
  const accessKey = env["TF_STATE_R2_ACCESS_KEY_ID"];
  const secretKey = env["TF_STATE_R2_SECRET_ACCESS_KEY"];
  const accountId = env["CLOUDFLARE_ACCOUNT_ID"];
  const bucket = env["STATE_BUCKET"] ?? "tfstate";
  if (!accessKey || !secretKey || !accountId) return notSet(name);
  const host = `${accountId}.r2.cloudflarestorage.com`;
  const stamp = now
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
  const date = stamp.slice(0, 8);
  const query = "list-type=2&max-keys=1";
  const payloadHash = sha256("");
  const canonical = [
    "GET",
    `/${bucket}`,
    query,
    `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${stamp}\n`,
    "host;x-amz-content-sha256;x-amz-date",
    payloadHash,
  ].join("\n");
  const scope = `${date}/auto/s3/aws4_request`;
  const toSign = ["AWS4-HMAC-SHA256", stamp, scope, sha256(canonical)].join(
    "\n",
  );
  const signingKey = hmac(
    hmac(hmac(hmac(`AWS4${secretKey}`, date), "auto"), "s3"),
    "aws4_request",
  );
  const signature = createHmac("sha256", signingKey)
    .update(toSign)
    .digest("hex");
  const result = await call(`https://${host}/${bucket}?${query}`, {
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": stamp,
    authorization: `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=${signature}`,
  });
  return toResult(name, rejected(result.status));
};

export const checkSupabase = async (env: Env) => {
  const name = "DEV_SUPABASE_ACCESS_TOKEN";
  const token = env["SUPABASE_ACCESS_TOKEN"];
  if (!token) return notSet(name);
  const result = await call(
    "https://api.supabase.com/v1/projects",
    bearer(token),
  );
  return toResult(name, rejected(result.status));
};

export const checkGrafana = async (env: Env, now: Date) => {
  const name = "GRAFANA_CLOUD_ACCESS_POLICY_TOKEN";
  const token = env["GRAFANA_CLOUD_ACCESS_POLICY_TOKEN"];
  const region = env["GRAFANA_REGION"];
  if (!token || !region) return notSet(name);
  const headers = bearer(token);
  const policies = await call(
    `https://grafana.com/api/v1/accesspolicies?region=${encodeURIComponent(region)}`,
    headers,
  );
  const failure = rejected(policies.status);
  if (failure) return toResult(name, failure);
  const items = (policies.body as { items?: { id: string }[] }).items ?? [];
  let earliest: string | undefined;
  for (const policy of items) {
    const tokens = await call(
      `https://grafana.com/api/v1/tokens?region=${encodeURIComponent(region)}&accessPolicyId=${encodeURIComponent(policy.id)}`,
      headers,
    );
    const list =
      (tokens.body as { items?: { expiresAt?: string | null }[] })?.items ?? [];
    for (const entry of list) {
      if (entry.expiresAt && (!earliest || entry.expiresAt < earliest)) {
        earliest = entry.expiresAt;
      }
    }
  }
  return toResult(name, expiryReason(earliest, now));
};

export const checkClerk = async (env: Env) => {
  const name = "DEV_CLERK_SECRET_KEY";
  const token = env["CLERK_SECRET_KEY"];
  if (!token) return notSet(name);
  const result = await call("https://api.clerk.com/v1/instance", bearer(token));
  return toResult(name, rejected(result.status));
};

export const checkGroq = async (env: Env) => {
  const name = "DEV_GROQ_API_KEY";
  const token = env["GROQ_API_KEY"];
  if (!token) return notSet(name);
  const result = await call(
    "https://api.groq.com/openai/v1/models",
    bearer(token),
  );
  return toResult(name, rejected(result.status));
};
