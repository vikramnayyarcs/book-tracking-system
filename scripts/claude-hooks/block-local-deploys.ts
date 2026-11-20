import { runHook, stringField, type HookInput } from "./hook-io.ts";

const COMMAND_START = String.raw`(?:^|[;&|(\n{]|\$\(|\x60)\s*`;
const ENV_ASSIGNMENTS = String.raw`(?:[A-Za-z_][A-Za-z0-9_]*=\S*\s+)*`;
const LAUNCHER = String.raw`(?:sudo\s+)?(?:cmd(?:\.exe)?\s+\/c\s+)?(?:(?:npx|pnpx|bunx)(?:\s+-\S+)*\s+|npm\s+exec\s+(?:--\s+)?)?`;
const PATH_PREFIX = String.raw`(?:[\w.:\\/-]*[\\/])?`;
const GLOBAL_FLAGS = String.raw`(?:\s+--?[\w-]+(?:[= ](?!-)\S+)?)*`;
const END = String.raw`(?=\s|$|[;&|)}])`;

const tool = (name: string, subcommands: string[]) =>
  new RegExp(
    `${COMMAND_START}${ENV_ASSIGNMENTS}${LAUNCHER}${PATH_PREFIX}${name}(?:\\.exe|\\.cmd)?${GLOBAL_FLAGS}\\s+(?:${subcommands.join("|")})${END}`,
    "i",
  );

const RULES = [
  {
    pattern: tool("terraform", [
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
    pattern: tool("wrangler", [
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
    pattern: tool("supabase", [
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

export const stripHeredocBodies = (command: string) =>
  command.replace(
    /<<-?\s*(['"]?)(\w+)\1[^\n]*\n[\s\S]*?\n\s*\2(?=\s|$)/g,
    "<<heredoc",
  );

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
