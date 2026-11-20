import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

export const git = (cwd: string, ...args: string[]) => {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
  }
  return result.stdout;
};

export const createTempRepo = async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "bt-repo-"));
  git(dir, "init", "-q", "-b", "main");
  git(dir, "config", "user.email", "test@example.com");
  git(dir, "config", "user.name", "Test");
  git(dir, "config", "core.autocrlf", "false");
  await writeFile(path.join(dir, ".prettierrc.json"), "{}\n");
  const write = async (file: string, content: string) => {
    const full = path.join(dir, file);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, content);
  };
  return {
    dir,
    write,
    stage: (...files: string[]) => git(dir, "add", "--", ...files),
    commit: (message: string) => git(dir, "commit", "-q", "-m", message),
    remove: () => rm(dir, { recursive: true, force: true }),
  };
};

export const fakeGithubToken = () => {
  const alphabet =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const body = Array.from(
    randomBytes(36),
    (byte) => alphabet[byte % alphabet.length],
  ).join("");
  return ["gh", "p_", body].join("");
};
