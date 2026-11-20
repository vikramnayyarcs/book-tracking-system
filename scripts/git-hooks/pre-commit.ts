import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import * as prettier from "prettier";

export const stagedFiles = (cwd: string) => {
  const result = spawnSync(
    "git",
    ["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"],
    { cwd, encoding: "utf8" },
  );
  if (result.status !== 0) {
    throw new Error(`git diff failed: ${result.stderr}`);
  }
  return result.stdout.split("\0").filter(Boolean);
};

export const scanStagedForSecrets = (cwd: string) => {
  const result = spawnSync(
    "gitleaks",
    [
      "git",
      "--pre-commit",
      "--staged",
      "--redact",
      "--verbose",
      "--no-banner",
      "--no-color",
      cwd,
    ],
    { cwd, encoding: "utf8" },
  );
  if (result.error) {
    return {
      ok: false,
      output: `gitleaks could not run (${result.error.message}). Install it: winget install Gitleaks.Gitleaks`,
    };
  }
  return {
    ok: result.status === 0,
    output: `${result.stdout}${result.stderr}`,
  };
};

export const findUnformatted = async (cwd: string, files: string[]) => {
  const ignorePath = path.join(cwd, ".prettierignore");
  const unformatted: string[] = [];
  for (const file of files) {
    const filepath = path.join(cwd, file);
    const info = await prettier.getFileInfo(filepath, { ignorePath });
    if (info.ignored || info.inferredParser === null) {
      continue;
    }
    const options = (await prettier.resolveConfig(filepath)) ?? {};
    const source = await readFile(filepath, "utf8");
    if (!(await prettier.check(source, { ...options, filepath }))) {
      unformatted.push(file);
    }
  }
  return unformatted;
};

export const runPreCommit = async (cwd: string) => {
  const problems: string[] = [];
  const secrets = scanStagedForSecrets(cwd);
  if (!secrets.ok) {
    problems.push(`Possible secret in staged changes:\n${secrets.output}`);
  }
  const unformatted = await findUnformatted(cwd, stagedFiles(cwd));
  if (unformatted.length > 0) {
    problems.push(
      `Not formatted with Prettier (run npm run format):\n${unformatted.map((file) => `  ${file}`).join("\n")}`,
    );
  }
  return problems;
};

if (import.meta.main) {
  const problems = await runPreCommit(process.cwd());
  if (problems.length > 0) {
    console.error(problems.join("\n\n"));
    process.exit(1);
  }
}
