import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTempRepo, fakeGithubToken } from "../temp-repo.test-utils.ts";
import { decide } from "./guard-commits.ts";

const withoutPath = (env: NodeJS.ProcessEnv) =>
  Object.fromEntries(
    Object.entries(env).filter(([key]) => key.toUpperCase() !== "PATH"),
  );

const bash = (command: string) => ({
  tool_name: "Bash",
  tool_input: { command },
});

let repo: Awaited<ReturnType<typeof createTempRepo>>;

beforeEach(async () => {
  repo = await createTempRepo();
});

afterEach(async () => {
  await repo.remove();
});

describe("decide", () => {
  it.each([
    'git commit --no-verify -m "x"',
    'git commit -n -m "x"',
    'git add -A && git commit -m "x" --no-verify',
    'SKIP_SIMPLE_GIT_HOOKS=1 git commit -m "x"',
    'git -c core.hooksPath=/dev/null commit -m "x"',
    'git push && git commit -m "x" -n',
    'echo $(git commit --no-verify -m "x")',
  ])("blocks skipping the pre-commit hook: %s", (command) => {
    expect(decide(bash(command), repo.dir)).toContain(
      "must run the pre-commit hook",
    );
  });

  it("blocks a commit when a secret is staged", async () => {
    await repo.write("config.ts", `export const t = "${fakeGithubToken()}";\n`);
    repo.stage("config.ts");

    expect(decide(bash('git commit -m "add config"'), repo.dir)).toContain(
      "possible secret",
    );
  });

  it("only checks the commit's own flags, not later commands", async () => {
    await repo.write("config.ts", 'export const name = "shelf";\n');
    repo.stage("config.ts");

    expect(
      decide(bash('git commit -m "x" && grep -n --no-verify notes'), repo.dir),
    ).toBeUndefined();
  });

  it("allows a commit of clean staged changes", async () => {
    await repo.write("config.ts", 'export const name = "shelf";\n');
    repo.stage("config.ts");

    expect(
      decide(bash("git commit -q -F - <<'EOF'\nAdd config\nEOF"), repo.dir),
    ).toBeUndefined();
  });

  it("ignores commands that are not commits", async () => {
    await repo.write("config.ts", `export const t = "${fakeGithubToken()}";\n`);
    repo.stage("config.ts");

    expect(decide(bash("git status --short"), repo.dir)).toBeUndefined();
    expect(
      decide(bash('grep -rn "git commit --no-verify" docs'), repo.dir),
    ).toBeUndefined();
    expect(
      decide(
        bash(
          'gh pr create --body "blocks \\`git commit --no-verify\\` and \\`-n\\`"',
        ),
        repo.dir,
      ),
    ).toBeUndefined();
  });

  it("blocks with an install hint when gitleaks is not on PATH", async () => {
    await repo.write("config.ts", 'export const name = "shelf";\n');
    repo.stage("config.ts");
    const result = spawnSync(
      process.execPath,
      [fileURLToPath(new URL("guard-commits.ts", import.meta.url))],
      {
        input: JSON.stringify(bash('git commit -m "x"')),
        env: {
          ...withoutPath(process.env),
          CLAUDE_PROJECT_DIR: repo.dir,
          PATH: repo.dir,
        },
        encoding: "utf8",
      },
    );

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("need a secrets scan first");
    expect(result.stderr).not.toContain("found a possible secret");
  });

  it("exits 2 when run as a hook", () => {
    const result = spawnSync(
      process.execPath,
      [fileURLToPath(new URL("guard-commits.ts", import.meta.url))],
      {
        input: JSON.stringify(bash('git commit --no-verify -m "x"')),
        env: { ...process.env, CLAUDE_PROJECT_DIR: repo.dir },
        encoding: "utf8",
      },
    );

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("Blocked");
  });
});
