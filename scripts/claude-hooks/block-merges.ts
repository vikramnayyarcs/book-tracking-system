import { spawnSync } from "node:child_process";
import {
  commandPattern,
  segmentsMatching,
  stripHeredocBodies,
} from "./command-pattern.ts";
import { runHook, stringField, type HookInput } from "./hook-io.ts";

const PROTECTED_BRANCH = "main";

const GH_OWNER_ONLY = commandPattern("gh", [
  String.raw`pr\s+merge`,
  String.raw`workflow\s+run`,
  String.raw`run\s+rerun`,
]);
const RERUN_FAILED_ONCE =
  /^\s*gh\s+run\s+rerun\s+(\d+)\s+--failed(?:\s+(?:-R|--repo)\s+\S+)?\s*$/;

export const runAttempt = (runId: string, projectDir: string) => {
  const result = spawnSync(
    "gh",
    ["run", "view", runId, "--json", "attempt", "--jq", ".attempt"],
    { cwd: projectDir, encoding: "utf8" },
  );
  return result.status === 0 ? Number(result.stdout.trim()) : Number.NaN;
};

export const isFirstFailedRerun = (
  visible: string,
  attemptOf: (runId: string) => number,
) => {
  const match = RERUN_FAILED_ONCE.exec(visible.trim());
  return match?.[1] !== undefined && attemptOf(match[1]) === 1;
};

const GH_MERGE_API =
  /(?:^|[;&|(\n])\s*gh\b[^;&|\n]*\bapi\b[^;&|\n]*\/(?:pulls\/\d+\/merge|merges)(?![\w/])/i;
const GIT_PUSH = commandPattern("git", ["push"], "gi");
const TARGETS_PROTECTED = new RegExp(
  String.raw`^\+?(?:[^:\s]*:)?(?:refs\/heads\/)?${PROTECTED_BRANCH}$`,
);

const currentBranch = (projectDir: string) =>
  spawnSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
    cwd: projectDir,
    encoding: "utf8",
  }).stdout.trim();

export const pushTargetsProtected = (segment: string, branch: string) => {
  const args = segment
    .replace(/^[\s\S]*?\bpush\b/, "")
    .trim()
    .split(/\s+/);
  if (args.some((arg) => arg === "--all" || arg === "--mirror")) {
    return true;
  }
  const refspecs = args.filter((arg) => arg && !arg.startsWith("-")).slice(1);
  if (refspecs.length === 0) {
    return branch === PROTECTED_BRANCH;
  }
  return refspecs.some(
    (refspec) =>
      TARGETS_PROTECTED.test(refspec) ||
      (refspec === "HEAD" && branch === PROTECTED_BRANCH),
  );
};

export const decide = (input: HookInput, projectDir: string) => {
  const command = stringField(input, "command");
  if (!command) {
    return undefined;
  }
  const visible = stripHeredocBodies(command);
  if (isFirstFailedRerun(visible, (id) => runAttempt(id, projectDir))) {
    return undefined;
  }
  if (GH_OWNER_ONLY.test(visible) || GH_MERGE_API.test(visible)) {
    return "Blocked: merging PRs and triggering workflows are for the owner. The only exception is one `gh run rerun <id> --failed` on a run's first attempt, after an infrastructure failure (CLAUDE.md). Otherwise open or update the PR and leave it for review; say which workflow should be run if one is needed.";
  }
  const pushes = segmentsMatching(visible, GIT_PUSH);
  if (pushes.length > 0) {
    const branch = currentBranch(projectDir);
    if (pushes.some((segment) => pushTargetsProtected(segment, branch))) {
      return `Blocked: never push to ${PROTECTED_BRANCH}. Push a feature branch and open a PR.`;
    }
  }
  return undefined;
};

if (import.meta.main) {
  await runHook(decide);
}
