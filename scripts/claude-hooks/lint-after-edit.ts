import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { runHook, stringField, type HookInput } from "./hook-io.ts";

const LINTABLE = /\.(?:[cm]?[jt]sx?|astro)$/i;
const TYPED = /\.[cm]?tsx?$/i;

const require = createRequire(import.meta.url);
const binOf = (pkg: string, relative: string) =>
  path.join(path.dirname(require.resolve(`${pkg}/package.json`)), relative);

const run = (projectDir: string, bin: string, args: string[]) => {
  const result = spawnSync(process.execPath, [bin, ...args], {
    cwd: projectDir,
    encoding: "utf8",
  });
  return {
    ok: result.status === 0,
    output: `${result.stdout}${result.stderr}`.trim(),
  };
};

export const lintFile = (projectDir: string, file: string) =>
  run(projectDir, binOf("oxlint", "bin/oxlint"), [
    "--deny-warnings",
    "--no-error-on-unmatched-pattern",
    file,
  ]);

export const typecheck = (projectDir: string) =>
  run(projectDir, binOf("typescript", "bin/tsc"), ["-p", "tsconfig.json"]);

export const decide = (input: HookInput, projectDir: string) => {
  const file = stringField(input, "file_path");
  if (!file || !LINTABLE.test(file) || file.includes("node_modules")) {
    return undefined;
  }
  const problems: string[] = [];
  const lint = lintFile(projectDir, file);
  if (!lint.ok) {
    problems.push(`Oxlint:\n${lint.output}`);
  }
  if (TYPED.test(file) && existsSync(path.join(projectDir, "tsconfig.json"))) {
    const types = typecheck(projectDir);
    if (!types.ok) {
      problems.push(`Typecheck:\n${types.output}`);
    }
  }
  return problems.length > 0
    ? `Fix these before moving on:\n\n${problems.join("\n\n")}`
    : undefined;
};

if (import.meta.main) {
  await runHook(decide);
}
