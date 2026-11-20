import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { decide } from "./block-local-deploys.ts";

const bash = (command: string) => ({
  tool_name: "Bash",
  tool_input: { command },
});

describe("decide", () => {
  it.each([
    "terraform apply",
    "terraform apply -auto-approve",
    "terraform -chdir=infra/envs/dev apply",
    "terraform -chdir infra/envs/dev destroy",
    "terraform import github_repository.this book-tracking-system",
    "terraform state rm module.x",
    "terraform force-unlock 123",
    "cd infra && terraform apply",
    "terraform fmt -check; terraform apply",
    "TF_LOG=debug terraform apply",
    "terraform.exe apply",
    "C:/tools/terraform.exe apply",
    "& terraform apply",
    "echo $(terraform apply)",
  ])("blocks terraform: %s", (command) => {
    expect(decide(bash(command))).toContain("GitHub Actions");
  });

  it.each([
    "wrangler deploy",
    "npx wrangler deploy",
    "npx -y wrangler pages deploy dist --project-name site-dev",
    "cmd /c npx wrangler deploy",
    "npm exec -- wrangler deploy",
    "wrangler --config wrangler.toml deploy",
    "wrangler versions deploy",
    "wrangler r2 bucket create tfstate",
    "wrangler secret put API_KEY",
    "./node_modules/.bin/wrangler deploy",
  ])("blocks wrangler: %s", (command) => {
    expect(decide(bash(command))).toContain("Cloudflare");
  });

  it.each([
    "supabase db push",
    "npx supabase db push --linked",
    "supabase functions deploy api",
    "supabase secrets set GROQ_KEY=x",
    "supabase db reset --linked",
    "supabase migration repair 2026 --status applied",
  ])("blocks supabase: %s", (command) => {
    expect(decide(bash(command))).toContain("Supabase");
  });

  it.each([
    "terraform fmt -recursive",
    "terraform validate",
    "terraform plan",
    "terraform plan -destroy",
    "terraform init -backend=false",
    "terraform state list",
    "terraform providers lock -platform=linux_amd64",
    "wrangler dev",
    "wrangler pages deployment list",
    "wrangler whoami",
    "supabase start",
    "supabase db reset",
    "supabase migration new books",
    "supabase functions serve",
    "grep -r 'terraform apply' docs",
    'git commit -m "explain why terraform apply runs in CI"',
    "git commit -F - <<'EOF'\nNever run\nterraform apply\nlocally\nEOF",
    "npm test",
  ])("allows: %s", (command) => {
    expect(decide(bash(command))).toBeUndefined();
  });

  it("checks PowerShell commands too", () => {
    expect(
      decide({
        tool_name: "PowerShell",
        tool_input: { command: "terraform apply" },
      }),
    ).toContain("GitHub Actions");
  });

  it("exits 2 when run as a hook", () => {
    const result = spawnSync(
      process.execPath,
      [fileURLToPath(new URL("block-local-deploys.ts", import.meta.url))],
      {
        input: JSON.stringify(bash("npx wrangler deploy")),
        encoding: "utf8",
      },
    );

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("Blocked");
  });
});
