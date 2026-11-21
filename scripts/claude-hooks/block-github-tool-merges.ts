import { runHook, stringField, type HookInput } from "./hook-io.ts";

const PREFIX = "mcp__github__";
const PROTECTED_BRANCH = "main";
const READ_ONLY = /^(?:get|list|search|download)_/;
const OWNER_ONLY =
  /merge|workflow|rerun|dispatch|repository$|delete_repo|transfer/i;
const WRITES_TO_BRANCH = new Set([
  "push_files",
  "create_or_update_file",
  "delete_file",
]);

export const decide = (input: HookInput) => {
  if (!input.tool_name.startsWith(PREFIX)) {
    return undefined;
  }
  const tool = input.tool_name.slice(PREFIX.length);
  if (READ_ONLY.test(tool)) {
    return undefined;
  }
  if (OWNER_ONLY.test(tool)) {
    return `Blocked: ${tool} is for the owner. Merging PRs, running workflows and changing repository settings happen only after review; open or update the PR instead.`;
  }
  if (WRITES_TO_BRANCH.has(tool)) {
    const branch = stringField(input, "branch");
    if (!branch || branch === PROTECTED_BRANCH) {
      return `Blocked: ${tool} must name a feature branch, never ${PROTECTED_BRANCH}. Push to a branch and open a PR.`;
    }
  }
  return undefined;
};

if (import.meta.main) {
  await runHook(decide);
}
