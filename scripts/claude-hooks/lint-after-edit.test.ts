import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decide } from "./lint-after-edit.ts";

const edit = (filePath: string) => ({
  tool_name: "Edit",
  tool_input: { file_path: filePath },
});

let project: string;

const write = async (file: string, content: string) => {
  const full = path.join(project, file);
  await writeFile(full, content);
  return full;
};

beforeEach(async () => {
  project = await mkdtemp(path.join(tmpdir(), "bt-lint-"));
  await write(
    "tsconfig.json",
    JSON.stringify({
      compilerOptions: { strict: true, noEmit: true, skipLibCheck: true },
      include: ["*.ts"],
    }),
  );
  await write(
    ".oxlintrc.json",
    JSON.stringify({ rules: { "no-debugger": "error" } }),
  );
});

afterEach(async () => {
  await rm(project, { recursive: true, force: true });
});

describe("decide", () => {
  it("reports lint errors in the edited file", async () => {
    const file = await write(
      "a.ts",
      "export const a = () => {\n  debugger;\n};\n",
    );

    expect(decide(edit(file), project)).toContain("no-debugger");
  });

  it("reports type errors in the project", async () => {
    const file = await write("b.ts", 'export const b: number = "nope";\n');

    expect(decide(edit(file), project)).toContain("Typecheck");
  });

  it("passes a clean file", async () => {
    const file = await write("c.ts", "export const c = 1;\n");

    expect(decide(edit(file), project)).toBeUndefined();
  });

  it("skips files Oxlint does not lint", async () => {
    const file = await write("notes.md", "debugger\n");

    expect(decide(edit(file), project)).toBeUndefined();
  });

  it("lints JavaScript without typechecking it", async () => {
    await write("broken.ts", 'export const x: number = "nope";\n');
    const file = await write("d.mjs", "export const d = 1;\n");

    expect(decide(edit(file), project)).toBeUndefined();
  });
});
