import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createTempRepo,
  fakeGithubToken,
  git,
} from "../temp-repo.test-utils.ts";
import {
  findUnformatted,
  runPreCommit,
  scanStagedForSecrets,
  stagedFiles,
} from "./pre-commit.ts";

let repo: Awaited<ReturnType<typeof createTempRepo>>;

beforeEach(async () => {
  repo = await createTempRepo();
});

afterEach(async () => {
  await repo.remove();
});

describe("stagedFiles", () => {
  it("lists added and modified files but not deleted ones", async () => {
    await repo.write("a.ts", "export const a = 1;\n");
    await repo.write("b.ts", "export const b = 1;\n");
    repo.stage("a.ts", "b.ts");
    repo.commit("init");
    await repo.write("a.ts", "export const a = 2;\n");
    await repo.write("c.ts", "export const c = 1;\n");
    repo.stage("a.ts", "c.ts");
    git(repo.dir, "rm", "-q", "b.ts");

    expect(stagedFiles(repo.dir).toSorted()).toEqual(["a.ts", "c.ts"]);
  });
});

describe("scanStagedForSecrets", () => {
  it("blocks a staged GitHub token", async () => {
    await repo.write(
      "config.ts",
      `export const token = "${fakeGithubToken()}";\n`,
    );
    repo.stage("config.ts");

    const result = scanStagedForSecrets(repo.dir);

    expect(result.ok).toBe(false);
    expect(result.output).toContain("github-pat");
  });

  it("passes clean staged changes", async () => {
    await repo.write("config.ts", 'export const name = "shelf";\n');
    repo.stage("config.ts");

    expect(scanStagedForSecrets(repo.dir).ok).toBe(true);
  });
});

describe("findUnformatted", () => {
  it("reports staged code that Prettier would change", async () => {
    await repo.write("ugly.ts", "export const  a={b:1}\n");
    await repo.write("tidy.ts", "export const a = { b: 1 };\n");

    expect(await findUnformatted(repo.dir, ["ugly.ts", "tidy.ts"])).toEqual([
      "ugly.ts",
    ]);
  });

  it("skips ignored files and files Prettier cannot parse", async () => {
    await repo.write(".prettierignore", "*.md\n");
    await repo.write("notes.md", "#  messy   heading\n");
    await repo.write("main.tf", 'resource  "x" "y" {}\n');

    expect(await findUnformatted(repo.dir, ["notes.md", "main.tf"])).toEqual(
      [],
    );
  });
});

describe("runPreCommit", () => {
  it("reports both a secret and bad formatting", async () => {
    await repo.write("bad.ts", `export const  t="${fakeGithubToken()}"\n`);
    repo.stage("bad.ts");

    const problems = await runPreCommit(repo.dir);

    expect(problems).toHaveLength(2);
    expect(problems[0]).toContain("Possible secret");
    expect(problems[1]).toContain("bad.ts");
  });

  it("returns no problems for a clean change", async () => {
    await repo.write("good.ts", "export const a = 1;\n");
    repo.stage("good.ts");

    expect(await runPreCommit(repo.dir)).toEqual([]);
  });
});
