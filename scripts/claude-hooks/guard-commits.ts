import { scanStagedForSecrets } from "../git-hooks/pre-commit.ts";
import { commandPattern, stripHeredocBodies } from "./command-pattern.ts";
import { runHook, stringField, type HookInput } from "./hook-io.ts";

const GIT_COMMIT = commandPattern("git", ["commit"]);
const HOOK_BYPASSES = [
  /\s--no-verify(?=\s|$)/,
  /\bgit\b[^;&|\n]*\scommit\b[^;&|\n]*\s-n(?=\s|$)/,
  /\bSKIP_SIMPLE_GIT_HOOKS=/,
  /\bcore\.hooksPath\b/i,
];

export const decide = (input: HookInput, projectDir: string) => {
  const command = stringField(input, "command");
  if (!command) {
    return undefined;
  }
  const visible = stripHeredocBodies(command);
  if (!GIT_COMMIT.test(visible)) {
    return undefined;
  }
  if (HOOK_BYPASSES.some((pattern) => pattern.test(visible))) {
    return "Blocked: commits must run the pre-commit hook (gitleaks and Prettier). Remove --no-verify, SKIP_SIMPLE_GIT_HOOKS or the core.hooksPath override, and fix what the hook reports.";
  }
  const scan = scanStagedForSecrets(projectDir);
  if (!scan.ran) {
    return `Blocked: commits need a secrets scan first. ${scan.output}. If it is installed, restart the editor so Claude Code sees the updated PATH.`;
  }
  if (!scan.ok) {
    return `Blocked: gitleaks found a possible secret in the staged changes. Unstage it, move the value to an environment variable or secret store, and reference it as \${VAR}.\n${scan.output}`;
  }
  return undefined;
};

if (import.meta.main) {
  await runHook(decide);
}
