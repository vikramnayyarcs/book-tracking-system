import { text } from "node:stream/consumers";

export type HookInput = {
  tool_name: string;
  tool_input: Record<string, unknown>;
  cwd?: string;
};

export const readHookInput = async () =>
  JSON.parse(await text(process.stdin)) as HookInput;

export const projectDirFor = (input: HookInput) =>
  process.env["CLAUDE_PROJECT_DIR"] ?? input.cwd ?? process.cwd();

export const stringField = (input: HookInput, key: string) => {
  const value = input.tool_input[key];
  return typeof value === "string" ? value : undefined;
};

export const runHook = async (
  decide: (input: HookInput, projectDir: string) => string | undefined,
) => {
  const input = await readHookInput();
  const reason = decide(input, projectDirFor(input));
  if (reason) {
    console.error(reason);
    process.exit(2);
  }
};
