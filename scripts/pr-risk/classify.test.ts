import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { classify } from "./classify.ts";

const file = (filename: string, lines = 10) => ({
  filename,
  additions: lines,
  deletions: 0,
});

describe("classify", () => {
  it.each([
    "infra/envs/dev/main.tf",
    ".github/workflows/ci.yml",
    "scripts/claude-hooks/block-merges.ts",
    "scripts/git-hooks/pre-commit.ts",
    "scripts/pr-risk/classify.ts",
    "supabase/migrations/20261121000000_users.sql",
    ".claude/settings.json",
    ".claude/settings.local.json",
    ".mcp.json",
    "scripts/cloud-setup.sh",
    "CLAUDE.md",
    "docs/secrets.md",
    "docs/adr/0009-phase-4-pwa.md",
    "docs/briefs/run-4-phase-4-musts.md",
    "docs/requirements.md",
    "packages/core/src/api/auth.ts",
    "apps/web/public/_headers",
  ])("is red when %s changes, even beside docs", (path) => {
    const result = classify([file("docs/GOTCHAS.md"), file(path)], "main");
    expect(result.colour).toBe("red");
    expect(result.reasons).toContain(`\`${path}\` is guarded`);
  });

  it("is red when a guarded file is renamed away", () => {
    const result = classify(
      [
        {
          filename: "docs/old-hook.md",
          previous_filename: "scripts/claude-hooks/old.ts",
          additions: 0,
          deletions: 0,
        },
      ],
      "main",
    );
    expect(result.colour).toBe("red");
  });

  it("flags red PRs that deploy", () => {
    expect(classify([file("infra/modules/x/main.tf")], "main").deploys).toBe(
      true,
    );
    expect(classify([file("CLAUDE.md")], "main").deploys).toBe(false);
  });

  it.each([
    [["docs/GOTCHAS.md"]],
    [["README.md"]],
    [["docs/cloud-environment.md", "docs/GOTCHAS.md"]],
    [[".claude/skills/infra-change/SKILL.md"]],
  ])("is green for documentation only: %j", (paths) => {
    const result = classify(
      paths.map((path) => file(path)),
      "main",
    );
    expect(result.colour).toBe("green");
  });

  it.each([
    "apps/web/src/routes/shelf.tsx",
    "apps/site/src/pages/index.astro",
    "packages/core/src/brand.ts",
    "package.json",
    "package-lock.json",
    "notes.md",
  ])("is yellow when %s changes", (path) => {
    const result = classify([file("docs/GOTCHAS.md"), file(path)], "main");
    expect(result.colour).toBe("yellow");
    expect(result.reasons).toContain(`\`${path}\` is not documentation`);
  });

  it("is yellow for large documentation changes", () => {
    const result = classify([file("docs/GOTCHAS.md", 301)], "main");
    expect(result.colour).toBe("yellow");
    expect(result.reasons[0]).toContain("301 lines");
  });

  it("allows exactly 300 lines", () => {
    expect(classify([file("docs/GOTCHAS.md", 300)], "main").colour).toBe(
      "green",
    );
  });

  it("is yellow for documentation stacked on another branch", () => {
    const result = classify([file("docs/GOTCHAS.md")], "feature/x");
    expect(result.colour).toBe("yellow");
    expect(result.reasons).toContain("targets `feature/x`, not `main`");
  });

  it("is yellow with no files", () => {
    expect(classify([], "main").colour).toBe("yellow");
  });

  it("reads stdin and prints JSON when run as a script", () => {
    const result = spawnSync(
      process.execPath,
      [fileURLToPath(new URL("classify.ts", import.meta.url))],
      {
        input: JSON.stringify({ base: "main", files: [file("README.md")] }),
        encoding: "utf8",
      },
    );
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ colour: "green" });
  });
});
