import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { decide } from "./block-github-tool-merges.ts";

const tool = (name: string, toolInput: Record<string, unknown> = {}) => ({
  tool_name: `mcp__github__${name}`,
  tool_input: toolInput,
});

describe("decide", () => {
  it.each([
    "merge_pull_request",
    "enable_pr_auto_merge",
    "run_workflow",
    "rerun_workflow_run",
    "rerun_failed_jobs",
    "cancel_workflow_run",
    "create_workflow_dispatch",
    "update_repository",
    "delete_repository",
    "create_repository",
  ])("blocks %s", (name) => {
    expect(decide(tool(name, { owner: "o", repo: "r" }))).toContain(
      "for the owner",
    );
  });

  it.each(["push_files", "create_or_update_file", "delete_file"])(
    "blocks %s on main or with no branch",
    (name) => {
      expect(decide(tool(name, { branch: "main" }))).toContain("never main");
      expect(decide(tool(name, {}))).toContain("never main");
    },
  );

  it.each(["push_files", "create_or_update_file", "delete_file"])(
    "allows %s on a feature branch",
    (name) => {
      expect(decide(tool(name, { branch: "task-3-site" }))).toBeUndefined();
    },
  );

  it.each([
    "list_issues",
    "issue_read",
    "issue_write",
    "add_issue_comment",
    "list_pull_requests",
    "create_pull_request",
    "update_pull_request",
    "pull_request_read",
    "create_branch",
    "list_workflow_runs",
    "get_workflow_run_logs",
    "download_workflow_run_artifact",
    "search_code",
  ])("allows %s", (name) => {
    expect(decide(tool(name, { branch: "main" }))).toBeUndefined();
  });

  it("ignores tools from other servers", () => {
    expect(
      decide({ tool_name: "mcp__other__merge_pull_request", tool_input: {} }),
    ).toBeUndefined();
  });

  it("exits 2 when run as a hook", () => {
    const result = spawnSync(
      process.execPath,
      [fileURLToPath(new URL("block-github-tool-merges.ts", import.meta.url))],
      {
        input: JSON.stringify(tool("merge_pull_request", { pullNumber: 1 })),
        encoding: "utf8",
      },
    );

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("Blocked");
  });
});
