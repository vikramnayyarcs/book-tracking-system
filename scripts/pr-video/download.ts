import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";

export type Run = {
  id: number;
  name: string;
  status: string;
  head_sha: string;
  created_at: string;
};

export type Artifact = {
  name: string;
  expired: boolean;
  workflow_run: { id: number };
};

const ARTIFACT = "pr-videos";

export const pickRun = (
  runs: Run[],
  artifacts: Artifact[],
  headSha: string,
) => {
  const withVideo = new Set(
    artifacts
      .filter((artifact) => artifact.name === ARTIFACT && !artifact.expired)
      .map((artifact) => artifact.workflow_run.id),
  );
  const candidates = runs
    .filter((run) => run.name === "CI" && withVideo.has(run.id))
    .toSorted((a, b) => b.created_at.localeCompare(a.created_at));
  return candidates.find((run) => run.head_sha === headSha) ?? candidates[0];
};

const gh = (...args: string[]) => {
  const result = spawnSync("gh", args, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`gh ${args.join(" ")} failed: ${result.stderr.trim()}`);
  }
  return result.stdout;
};

const ghJson = <T>(...args: string[]) => JSON.parse(gh(...args)) as T;

if (import.meta.main) {
  const pr = process.argv[2];
  if (!pr || !/^\d+$/.test(pr)) {
    console.error("Usage: npm run pr-video -- <PR number>");
    process.exit(1);
  }
  const repo = gh(
    "repo",
    "view",
    "--json",
    "nameWithOwner",
    "--jq",
    ".nameWithOwner",
  ).trim();
  const head = ghJson<{ sha: string; ref: string }>(
    "api",
    `repos/${repo}/pulls/${pr}`,
    "--jq",
    "{sha: .head.sha, ref: .head.ref}",
  );
  const runs = ghJson<{ workflow_runs: Run[] }>(
    "api",
    `repos/${repo}/actions/runs?branch=${encodeURIComponent(head.ref)}&per_page=50`,
  ).workflow_runs;
  const artifacts = ghJson<{ artifacts: Artifact[] }>(
    "api",
    `repos/${repo}/actions/artifacts?name=${ARTIFACT}&per_page=100`,
  ).artifacts;
  const run = pickRun(runs, artifacts, head.sha);
  if (!run) {
    console.error(
      `No ${ARTIFACT} download for PR #${pr}: CI hasn't finished, or it expired (kept 30 days).`,
    );
    process.exit(1);
  }
  const dir = path.join(".pr-videos", `pr-${pr}`);
  gh("run", "download", String(run.id), "--name", ARTIFACT, "--dir", dir);
  if (run.head_sha !== head.sha) {
    console.log(
      `Note: newest video is from an older commit (${run.head_sha.slice(0, 7)}).`,
    );
  }
  for (const file of readdirSync(dir, { recursive: true })) {
    console.log(path.join(dir, String(file)));
  }
}
