export type KeyResult = {
  name: string;
  ok: boolean;
  reason?: string;
};

export const EXPIRY_WINDOW_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

export const expiryReason = (
  expiresAt: string | null | undefined,
  now: Date,
  windowDays = EXPIRY_WINDOW_DAYS,
) => {
  if (!expiresAt) return undefined;
  const expires = new Date(expiresAt);
  if (Number.isNaN(expires.getTime())) return "expiry date unreadable";
  const daysLeft = Math.floor((expires.getTime() - now.getTime()) / DAY_MS);
  if (daysLeft < 0) return "expired";
  if (daysLeft < windowDays) return `expires in ${daysLeft} days`;
  return undefined;
};

export const toResult = (name: string, reason: string | undefined) => {
  const result = reason ? { name, ok: false, reason } : { name, ok: true };
  return result satisfies KeyResult;
};

export const failedKeys = (results: KeyResult[]) =>
  results.filter((result) => !result.ok);

export const issueBody = (failed: KeyResult[]) =>
  [
    "The nightly key check found keys that need attention. Roll them as described in `docs/secrets.md`.",
    "",
    ...failed.map((result) => `- \`${result.name}\`: ${result.reason}`),
  ].join("\n");
