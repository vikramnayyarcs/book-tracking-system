import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTempRepo } from "../temp-repo.test-utils.ts";
import { decide, isEnvFile } from "./protect-files.ts";

const edit = (filePath: string) => ({
  tool_name: "Edit",
  tool_input: { file_path: filePath },
});

describe("isEnvFile", () => {
  it.each([".env", ".env.local", ".env.production", "apps/web/.env.dev"])(
    "treats %s as a secrets file",
    (file) => {
      expect(isEnvFile(file)).toBe(true);
    },
  );

  it.each([".env.example", "env.ts", ".envrc.md", "src/environment.ts"])(
    "allows %s",
    (file) => {
      expect(isEnvFile(file)).toBe(false);
    },
  );
});

describe("decide", () => {
  let repo: Awaited<ReturnType<typeof createTempRepo>>;
  const migration = "supabase/migrations/20261120000000_books.sql";

  beforeEach(async () => {
    repo = await createTempRepo();
    await repo.write(migration, "create table books ();\n");
    repo.stage(migration);
    repo.commit("add books migration");
  });

  afterEach(async () => {
    await repo.remove();
  });

  it("blocks edits to .env files by absolute path", () => {
    expect(decide(edit(path.join(repo.dir, ".env")), repo.dir)).toContain(
      "never edited by Claude",
    );
  });

  it("blocks edits to a migration that is on main", () => {
    expect(decide(edit(path.join(repo.dir, migration)), repo.dir)).toContain(
      "Never edit an applied migration",
    );
  });

  it("blocks a migration on main given a relative path", () => {
    expect(decide(edit(migration), repo.dir)).toContain(
      "Never edit an applied migration",
    );
  });

  it("allows a new migration that is not on main yet", () => {
    const fresh = "supabase/migrations/20261121000000_sessions.sql";
    expect(decide(edit(path.join(repo.dir, fresh)), repo.dir)).toBeUndefined();
  });

  it("allows ordinary files", () => {
    expect(
      decide(edit(path.join(repo.dir, "packages/core/src/a.ts")), repo.dir),
    ).toBeUndefined();
  });

  it("exits 2 with the reason on stderr when run as a hook", () => {
    const result = spawnSync(
      process.execPath,
      [fileURLToPath(new URL("protect-files.ts", import.meta.url))],
      {
        input: JSON.stringify(edit(path.join(repo.dir, migration))),
        env: { ...process.env, CLAUDE_PROJECT_DIR: repo.dir },
        encoding: "utf8",
      },
    );

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("Never edit an applied migration");
  });

  it("exits 0 for an allowed edit when run as a hook", () => {
    const result = spawnSync(
      process.execPath,
      [fileURLToPath(new URL("protect-files.ts", import.meta.url))],
      {
        input: JSON.stringify(edit(path.join(repo.dir, "README.md"))),
        env: { ...process.env, CLAUDE_PROJECT_DIR: repo.dir },
        encoding: "utf8",
      },
    );

    expect(result.status).toBe(0);
  });

  it("checks notebook edits too", () => {
    expect(
      decide(
        {
          tool_name: "NotebookEdit",
          tool_input: { notebook_path: path.join(repo.dir, ".env") },
        },
        repo.dir,
      ),
    ).toContain("never edited by Claude");
  });
});
