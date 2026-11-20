import { commandPattern, stripHeredocBodies } from "./command-pattern.ts";
import { runHook, stringField, type HookInput } from "./hook-io.ts";

const RULES = [
  {
    pattern: commandPattern("terraform", [
      "apply",
      "destroy",
      "import",
      "taint",
      "untaint",
      "force-unlock",
      String.raw`state\s+(?:rm|mv|push|replace-provider)`,
    ]),
    reason:
      "Terraform changes to real infrastructure run only in GitHub Actions. Use fmt, validate and plan locally; open a PR and let deploy-dev.yml apply it.",
  },
  {
    pattern: commandPattern("wrangler", [
      "deploy",
      "publish",
      "delete",
      "rollback",
      String.raw`versions\s+deploy`,
      String.raw`pages\s+deploy`,
      String.raw`pages\s+project\s+(?:create|delete)`,
      String.raw`r2\s+bucket\s+(?:create|delete)`,
      String.raw`kv\s+namespace\s+(?:create|delete)`,
      String.raw`secret\s+(?:put|delete|bulk)`,
    ]),
    reason:
      "Cloudflare deploys and resource changes run only in GitHub Actions or Terraform. Use `wrangler dev` locally.",
  },
  {
    pattern: commandPattern("supabase", [
      String.raw`db\s+push`,
      String.raw`functions\s+(?:deploy|delete)`,
      String.raw`secrets\s+(?:set|unset)`,
      String.raw`projects\s+(?:create|delete)`,
      String.raw`migration\s+repair`,
      String.raw`db\s+reset\s+(?:\S+\s+)*--linked`,
    ]),
    reason:
      "Supabase pushes and deploys run only in GitHub Actions. Work against the local stack (`supabase start`, `supabase db reset`).",
  },
];

export const decide = (input: HookInput) => {
  const command = stringField(input, "command");
  if (!command) {
    return undefined;
  }
  const visible = stripHeredocBodies(command);
  const rule = RULES.find(({ pattern }) => pattern.test(visible));
  return rule ? `Blocked: ${rule.reason}` : undefined;
};

if (import.meta.main) {
  await runHook(decide);
}
