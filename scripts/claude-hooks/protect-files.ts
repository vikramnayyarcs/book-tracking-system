import { spawnSync } from "node:child_process";
import path from "node:path";
import { runHook, stringField, type HookInput } from "./hook-io.ts";

const MIGRATIONS_DIR = "supabase/migrations/";
const BRANCHES_THAT_COUNT_AS_APPLIED = ["origin/main", "main"];

export const isEnvFile = (file: string) => {
  const name = path.basename(file);
  return /^\.env(\..+)?$/.test(name) && name !== ".env.example";
};

export const repoRelative = (projectDir: string, file: string) =>
  path
    .relative(projectDir, path.resolve(projectDir, file))
    .split(path.sep)
    .join("/");

export const existsOnMain = (projectDir: string, relativePath: string) =>
  BRANCHES_THAT_COUNT_AS_APPLIED.some(
    (ref) =>
      spawnSync("git", ["cat-file", "-e", `${ref}:${relativePath}`], {
        cwd: projectDir,
      }).status === 0,
  );

export const decide = (input: HookInput, projectDir: string) => {
  const file =
    stringField(input, "file_path") ?? stringField(input, "notebook_path");
  if (!file) {
    return undefined;
  }
  if (isEnvFile(file)) {
    return `Blocked: ${path.basename(file)} holds secrets and is never edited by Claude. Ask the user to change it, or edit .env.example instead.`;
  }
  const relative = repoRelative(projectDir, file);
  if (
    relative.startsWith(MIGRATIONS_DIR) &&
    existsOnMain(projectDir, relative)
  ) {
    return `Blocked: ${relative} is already on main, so it may have been applied. Never edit an applied migration; create a new one with \`supabase migration new <name>\`.`;
  }
  return undefined;
};

if (import.meta.main) {
  await runHook(decide);
}
