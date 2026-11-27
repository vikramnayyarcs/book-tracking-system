import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { expect } from "vitest";

const shown = new Set([
  "id",
  "bookId",
  "sessionId",
  "title",
  "author",
  "authors",
  "isbn",
  "status",
  "date",
  "pageFrom",
  "pageTo",
  "items",
  "error",
  "code",
  "expiresAt",
  "expiresIn",
]);

const hideUnlisted = (key: string, value: unknown) =>
  value === null || typeof value === "object" || shown.has(key)
    ? value
    : "[hidden]";

export const redact = (value: unknown) =>
  JSON.parse(JSON.stringify(value, hideUnlisted)) as unknown;

const parse = (text: string) => {
  if (text === "") {
    return null;
  }
  try {
    return redact(JSON.parse(text));
  } catch {
    return "[not JSON]";
  }
};

export const writeCallLog = async (
  directory: string,
  entry: {
    method: string;
    path: string;
    request: unknown;
    response: Response;
  },
) => {
  const testPath = expect.getState().testPath ?? "unknown.test.ts";
  const file = path.join(
    directory,
    `${path.basename(testPath, ".test.ts")}.jsonl`,
  );
  const line = {
    method: entry.method,
    path: `/v1${entry.path}`,
    status: entry.response.status,
    request: redact(entry.request),
    response: parse(await entry.response.clone().text()),
  };
  mkdirSync(directory, { recursive: true });
  appendFileSync(file, `${JSON.stringify(line)}\n`);
};
