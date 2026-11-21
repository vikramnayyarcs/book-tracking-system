import { readFileSync } from "node:fs";
import { failedKeys, issueBody, type KeyResult } from "./expiry.ts";

const TITLE = "Key check failed";

const token = process.env["GITHUB_TOKEN"];
const repo = process.env["GITHUB_REPOSITORY"];
const file = process.env["KEY_CHECK_RESULTS"];
if (!token || !repo || !file) {
  console.error("Set GITHUB_TOKEN, GITHUB_REPOSITORY and KEY_CHECK_RESULTS.");
  process.exit(2);
}

const api = async (path: string, method = "GET", body?: unknown) => {
  const response = await fetch(`https://api.github.com/repos/${repo}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "user-agent": "key-check",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok)
    throw new Error(`${method} ${path} failed: ${response.status}`);
  return response.json();
};

const results = JSON.parse(readFileSync(file, "utf8")) as KeyResult[];
const failed = failedKeys(results);
const open = (await api("/issues?state=open&per_page=100")) as {
  number: number;
  title: string;
  pull_request?: unknown;
}[];
const existing = open.find(
  (issue) => issue.title === TITLE && !issue.pull_request,
);

if (failed.length > 0) {
  const body = issueBody(failed);
  if (existing) await api(`/issues/${existing.number}`, "PATCH", { body });
  else await api("/issues", "POST", { title: TITLE, body });
} else if (existing) {
  await api(`/issues/${existing.number}`, "PATCH", {
    state: "closed",
    state_reason: "completed",
  });
}
