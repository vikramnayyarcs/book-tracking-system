import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTempRepo, git } from "../temp-repo.test-utils.ts";
import { decide, isFirstFailedRerun } from "./block-merges.ts";

const bash = (command: string) => ({
  tool_name: "Bash",
  tool_input: { command },
});

let repo: Awaited<ReturnType<typeof createTempRepo>>;

beforeEach(async () => {
  repo = await createTempRepo();
  await repo.write("README.md", "hello\n");
  repo.stage("README.md");
  repo.commit("init");
});

afterEach(async () => {
  await repo.remove();
});

describe("gh commands", () => {
  it.each([
    "gh pr merge 12 --merge",
    "gh pr merge --squash --delete-branch",
    "gh workflow run bootstrap.yml --ref main",
    "gh run rerun 44791324761",
    "gh api -X PUT repos/o/r/pulls/12/merge",
    "gh api repos/o/r/merges -f base=main -f head=feature",
    "cd repo && gh pr merge 3",
  ])("blocks %s", (command) => {
    expect(decide(bash(command), repo.dir)).toContain("for the owner");
  });

  it.each([
    "gh pr create --base main --title x --body y",
    "gh pr list",
    "gh pr view 12 --json mergeable",
    "gh workflow list",
    "gh run list --workflow bootstrap.yml",
    "gh run watch 123 --exit-status",
    "gh api -X PATCH repos/o/r/pulls/12 -f base=main",
    "gh api repos/o/r/pulls/12",
    'gh pr create --body "the owner runs \\`gh pr merge\\` after review"',
  ])("allows %s", (command) => {
    expect(decide(bash(command), repo.dir)).toBeUndefined();
  });
});

describe("git push", () => {
  it.each([
    "git push origin main",
    "git push origin HEAD:main",
    "git push -f origin feature:main",
    "git push origin +main",
    "git push origin refs/heads/main",
    "git push --all origin",
    "git push --mirror",
  ])("blocks %s from any branch", (command) => {
    git(repo.dir, "checkout", "-q", "-b", "feature");
    expect(decide(bash(command), repo.dir)).toContain("never push to main");
  });

  it.each(["git push", "git push origin", "git push -u origin HEAD"])(
    "blocks %s while on main",
    (command) => {
      expect(decide(bash(command), repo.dir)).toContain("never push to main");
    },
  );

  it.each([
    "git push",
    "git push -u origin feature",
    "git push -u origin HEAD",
    "git push --force-with-lease origin feature",
    "git push origin feature:feature",
    "git push origin maintenance",
  ])("allows %s from a feature branch", (command) => {
    git(repo.dir, "checkout", "-q", "-b", "feature");
    expect(decide(bash(command), repo.dir)).toBeUndefined();
  });
});

describe("as a hook", () => {
  it("exits 2 with the reason", () => {
    const result = spawnSync(
      process.execPath,
      [fileURLToPath(new URL("block-merges.ts", import.meta.url))],
      {
        input: JSON.stringify(bash("gh pr merge 1")),
        env: { ...process.env, CLAUDE_PROJECT_DIR: repo.dir },
        encoding: "utf8",
      },
    );

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("Blocked");
  });
});

const firstAttempt = () => 1;
const secondAttempt = () => 2;

describe("re-running failed jobs after an infrastructure failure", () => {
  it("allows one failed-jobs re-run on a run's first attempt", () => {
    expect(isFirstFailedRerun("gh run rerun 4512 --failed", firstAttempt)).toBe(
      true,
    );
    expect(
      isFirstFailedRerun("gh run rerun 4512 --failed -R o/r", firstAttempt),
    ).toBe(true);
  });

  it.each([
    ["a second attempt", "gh run rerun 4512 --failed", secondAttempt],
    ["a whole-run re-run", "gh run rerun 4512", firstAttempt],
    [
      "a chained command",
      "gh run rerun 4512 --failed && gh pr merge 3",
      firstAttempt,
    ],
    ["a job re-run", "gh run rerun 4512 --job 9", firstAttempt],
  ])("does not allow %s", (_name, command, attempt) => {
    expect(isFirstFailedRerun(command, attempt)).toBe(false);
  });
});
