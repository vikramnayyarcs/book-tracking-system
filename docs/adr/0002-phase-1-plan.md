# ADR 0002: Phase 1 plan (Foundations: IaC and CI/CD)

- Status: Accepted; merge policy superseded by ADR 0004
- Date: 2026-11-20
- Decider: Vikram Nayyar
- Method: `/grill-me` session, four rounds

## Context

Phase 1 builds the foundations in ADR 0001: repo, Terraform with state in R2, Cloudflare, Supabase, GitHub and Grafana modules, CI/CD, hooks, MCP config and the first project skills. No domain or public name exists yet. Accounts exist for GitHub and Cloudflare; Supabase, Grafana Cloud and Clerk may not. The repo is private on GitHub Free.

## Decision

### Repo and tooling

- **npm workspaces**, Node 24. A folder is created only in the phase that first needs it. Phase 1 creates `infra/`, `apps/site`, `packages/core` (holding only `src/brand.ts`), `.github/` and `scripts/`. `supabase/` (CLI layout) arrives in Phase 2, the rest in later phases.
- **Formatting:** Prettier; `terraform fmt` for `.tf`.
- **Lint:** Oxlint with the Landmines recommended config, all 10 rules on, including `no-comments` and `no-explicit-return-types`. `no-comments` sets `publicApi` to `packages/core` and `packages/api-contract` so exported API can carry TSDoc. Exceptions go in per-rule allowlists with a reason; counts only go down.
- **Tests:** Playwright + axe from day one, starting with one smoke test on `apps/site`. Vitest tests sit next to the code they test.

### GitHub

- Private repo `book-tracking-system`, created once with `gh repo create --private --source . --push`, then adopted by Terraform with an `import` block.
- **Stays on GitHub Free.** That plan gives private repos no Environments, branch protection, required checks, required reviewers or secret scanning. Accepted for now; no upgrade planned.
  - **Trigger to revisit:** adding any collaborator needs GitHub Pro or Team.
  - **Accepted risk:** once production secrets exist, they are repo-level, so any workflow run, including one from a PR branch, can read them. Mitigations: `release-prod.yml` is manual-only and gated, gitleaks runs in CI and in hooks, and only the owner can push.
- **Secrets:** repo-level Actions secrets, prefixed per environment (`DEV_…`, later `PROD_…`). A workflow references only its own environment's prefix. Shared: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `TF_GITHUB_APP_ID`, `TF_GITHUB_APP_INSTALLATION_ID`, `TF_GITHUB_APP_PRIVATE_KEY`.
- **Terraform's GitHub identity:** a GitHub App (free, no token expiry), created once by hand, installed on this repo only, with Administration, Secrets and Dependabot alerts read/write. Setup steps go in `infra/README.md`.
- **The GitHub module manages:** repo settings (squash merge only, delete branch on merge), Dependabot alerts and security updates, Actions permissions (read-only `GITHUB_TOKEN` by default), and Actions secrets that Terraform generates.

### Terraform

- **Bootstrap:** `infra/bootstrap` runs only from the manual `bootstrap.yml` workflow. The first run creates the R2 state bucket using local state, then migrates its own state into the bucket in the same job. Later runs use R2.
- **Roots:** `infra/envs/dev` and `infra/envs/prod` share `infra/modules/*`, each with its own state key in R2. **Only dev is applied in Phase 1.** Prod code is written and planned but not applied.
- **Pins:** `required_version = "~> 1.17"`, providers pinned to a minor version, and `.terraform.lock.hcl` committed with hashes for both `windows_amd64` and `linux_amd64` (`terraform providers lock -platform=…`). A Windows-only lock file fails on Linux CI.
- **Hand-made credentials (the only exceptions to "everything in Terraform"):** the Cloudflare API token (Account: R2 Storage Edit, Cloudflare Pages Edit; Zone and Workers permissions added when those modules switch on) and the GitHub App.

### Resources Phase 1 creates

| Provider | Created in Phase 1 | Later |
| --- | --- | --- |
| Cloudflare | R2 state bucket (bootstrap); Pages projects `site-dev` and `site-prod` on `pages.dev` | Zone module (DNS, custom domains, WAF custom and rate limiting rules) is written but off until `var.domain` is set; PWA Pages projects in Phase 4; gateway Worker in Phase 3 |
| Supabase | Dev project, free plan, London (`eu-west-2`); its keys passed to GitHub secrets | Prod project when production is enabled; schema, buckets and auth in Phase 2 |
| GitHub | Repo settings, Dependabot, Actions permissions, generated secrets | Branch protection and Environments only if the plan changes |
| Grafana Cloud | One stack shared by dev and prod (an `env` label separates them), OTLP access token, synthetic uptime check on the site | Faro app in Phase 4; dashboards and alerts as data arrives |
| Clerk | `infra/clerk-checklist.md` for the dev instance | CI check script against Clerk's API in Phase 2 |

The Cloudflare scope can be revisited; each resource is a variable or module toggle.

### Workflows

1. **`ci.yml`** on every PR: Prettier check, Oxlint, typecheck, Vitest, Playwright + axe, gitleaks, `terraform fmt -check` and `validate`, and `terraform plan` for dev when `infra/` changes. The path filter keeps Dependabot PRs, which cannot read Actions secrets, from failing on plan.
2. **`deploy-dev.yml`** on push to `main`: Terraform apply for dev, then deploy `apps/site` to `site-dev`, each filtered by path.
3. **`bootstrap.yml`**, manual: creates and migrates the state bucket.
4. **`drift.yml`**, nightly: plan for dev; opens an issue on drift.
5. **`release-prod.yml`**, manual: written now, fails unless the repo variable `PROD_ENABLED` is `true`.

### Guard rails

- **Claude Code hooks**, written in Node so they run on Windows and in cloud sessions, each with colocated Vitest tests and each shipped as its own PR:
  1. Block edits to `.env*` files and to migrations already on `main`.
  2. Block local deploys: `terraform apply`/`destroy`, `wrangler deploy`/`pages deploy`, `supabase db push`, `supabase functions deploy`.
  3. Run gitleaks before any `git commit`.
  4. Run Oxlint on each edited file, then typecheck once there is TypeScript.
- **Git pre-commit hook** for the owner's own commits: `simple-git-hooks` running gitleaks and Prettier on staged files.

### MCP servers (`.mcp.json`, committed, no secrets)

| Server | When | Auth |
| --- | --- | --- |
| Context7 | Done | None (remote) |
| Terraform (HashiCorp `terraform-mcp-server` binary on PATH) | Done | None |
| GitHub (remote) | Once the repo exists | Token in a `BT_`-prefixed variable, or OAuth if supported |
| Cloudflare (remote) | Once the Cloudflare resources exist | OAuth |
| Supabase (remote, `read_only=true`, `project_ref` = dev) | Once the dev project exists | OAuth |
| Grafana | Once the stack exists | `BT_GRAFANA_DEV_TOKEN` |
| Playwright | Phase 4 | None |

Local environment variables for this project use the prefix **`BT_`** (from the repo name, not the product name), because Windows user variables are visible to every project.

### Cloud sessions

`scripts/cloud-setup.sh` installs pinned Terraform, gitleaks and `terraform-mcp-server`. The cloud environment's network allowlist:

- `github.com`, `api.github.com`, `codeload.github.com`, `objects.githubusercontent.com`
- `registry.npmjs.org`
- `releases.hashicorp.com`, `registry.terraform.io`
- `mcp.context7.com`
- `api.cloudflare.com`, `*.r2.cloudflarestorage.com`
- `api.supabase.com`, `mcp.supabase.com`
- `grafana.com`, `*.grafana.net`
- `cdn.playwright.dev`, `playwright.download.prss.microsoft.com` (browser downloads)

### Skills

- `adr`, straight after this ADR.
- `infra-change`, after the second Terraform module.

### PR order

0. Create the GitHub repo and push `main`.
1. This ADR, plus the CLAUDE.md secrets wording.
2. `adr` skill.
3. Root tooling: `package.json`, Prettier, Oxlint + Landmines, base `tsconfig`.
4. `ci.yml` (format, lint, gitleaks) and the git pre-commit hook.
5. to 8. One Claude Code hook per PR, with tests.
9. Terraform bootstrap and `bootstrap.yml`.
10. GitHub module, dev root and GitHub App.
11. `brand.ts`, `apps/site`, Playwright + axe smoke test.
12. Cloudflare Pages module and `deploy-dev.yml`; then the `infra-change` skill.
13. Supabase dev module; then the Supabase MCP server.
14. Grafana stack and uptime check; then the Grafana MCP server.
15. `drift.yml`, prod root and `release-prod.yml`.
16. Clerk checklist and `cloud-setup.sh`.

Work that needs an account the owner doesn't have yet stops at that point and waits.

## Consequences

- No domain is needed until launch. The marketing site is deployed in Phase 1 but not announced until the name is chosen. The waitlist link (Substack) is a placeholder in `brand.ts` until provided.
- Without Environments or branch protection, the rules are enforced by CI, hooks and discipline, not by GitHub. A red check doesn't block a merge.
- Dev only means Supabase's free plan (2 projects) leaves room for prod later. Free projects pause after 7 days without use.
- The GitHub App avoids token expiry but its private key is a long-lived secret; rotate it if it leaks.
