import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflows = ["plan-dev.yml", "deploy-dev.yml", "drift.yml"];

const runBlocks = (name: string) => {
  const lines = readFileSync(
    new URL(`../../.github/workflows/${name}`, import.meta.url),
    "utf8",
  ).split("\n");
  const blocks = new Array<string>();
  for (let i = 0; i < lines.length; i++) {
    const match = /^(\s*)(?:- )?run: (.*)$/.exec(lines[i] ?? "");
    if (!match) continue;
    const indent = (match[1] ?? "").length;
    const body = [match[2] ?? ""];
    for (let j = i + 1; j < lines.length; j++) {
      const line = lines[j] ?? "";
      if (line.trim() !== "" && line.search(/\S/) <= indent) break;
      body.push(line);
    }
    blocks.push(body.join("\n"));
  }
  return blocks;
};

const terraformBlocks = workflows.flatMap((name) =>
  runBlocks(name)
    .filter((block) => /terraform (plan|apply)\b/.test(block))
    .map((block) => ({ name, block })),
);

describe("terraform steps in workflows", () => {
  it("finds the plan and apply steps", () => {
    expect(terraformBlocks.length).toBeGreaterThanOrEqual(4);
  });

  it.each(terraformBlocks)(
    "$name: a piped plan fails the step when terraform fails",
    ({ block }) => {
      if (!/terraform plan[^\n]*\|\s*tee/.test(block)) return;
      expect(block).toMatch(/set -o pipefail|PIPESTATUS/);
    },
  );

  it.each(terraformBlocks)(
    "$name: every terraform plan and apply waits for the state lock",
    ({ block }) => {
      for (const line of block.split("\n")) {
        if (!/terraform (plan|apply)\b/.test(line)) continue;
        expect(line).toContain("-lock-timeout=5m");
      }
    },
  );

  it.each(workflows)(
    "%s: a new push never cancels a run that may hold the state lock",
    (name) => {
      const text = readFileSync(
        new URL(`../../.github/workflows/${name}`, import.meta.url),
        "utf8",
      );
      expect(text).toMatch(/cancel-in-progress: false/);
      expect(text).not.toMatch(/cancel-in-progress: true/);
    },
  );
});
