# Book Vault (placeholder name)

A private, AI-powered memory for the physical books you read: log a reading session with a voice note, AI turns it into insights, and you can search or ask your vault later.

Full requirements: `docs/requirements.md`. Read it before planning any phase or feature. Decisions live in `docs/adr/`.

## Stack

- **Runtime:** Node 24 for tooling, CI, the PWA and site builds (pinned in `.nvmrc` and `engines`). Supabase Edge Functions run on Deno, so `packages/core` stays runtime-agnostic: web-standard APIs only, no Node-only modules
- **Monorepo:** `apps/web` (React + Vite + TypeScript PWA), `apps/site` (static marketing site, Astro), `packages/core` (all business and AI logic, plain TypeScript), `packages/api-contract` (OpenAPI spec and generated types), `infra/` (Terraform)
- **API:** Hono on Supabase Edge Functions; the only way clients read or write data; served at the api subdomain through a Cloudflare Worker gateway (WAF in front)
- **Data:** Supabase Postgres + pgvector, Supabase Storage (private buckets, signed URLs)
- **Auth:** Clerk, connected to Supabase as third-party auth
- **AI:** cheapest model that passes evals, behind one AI module in `packages/core`; Groq (Whisper) for speech-to-text; separate embeddings provider
- **Hosting:** Cloudflare Pages (web and site), Cloudflare R2 for Terraform state
- **Observability:** Grafana Cloud via OpenTelemetry; Grafana Faro in the PWA
- **CI/CD:** GitHub Actions
- **Lint:** Oxlint with the Landmines plugins
- **Tests:** Vitest (pure logic), MSW for paid-provider HTTP, API tests against the local stack, Playwright + axe (PWA), DeepEval (AI outputs), k6 (load)

## Build order

1. Foundations: IaC and CI/CD
2. Data layer: schema, RLS, migrations
3. API: OpenAPI contract first, then endpoints
4. PWA
5. Launch readiness

The MCP server is a separate repo, built after launch. Do not start a later phase's work early.

## Non-negotiables

- **Infrastructure only through Terraform.** Never change Cloudflare, Supabase, GitHub or Grafana settings by hand. Clerk is the exception: follow `infra/clerk-checklist.md`.
- **Terraform apply and deploys run only in GitHub Actions**, never from a local or cloud session.
- **OpenAPI contract before code.** Change `packages/api-contract` first, then implement.
- **Logic lives in `packages/core`.** Edge Functions and the Worker are thin wrappers.
- **Every table has RLS and an RLS test** proving user A cannot read user B's data.
- **Never edit an applied migration.** Write a new one.
- **No test doubles.** Tests run against the real local stack. Paid third parties (Groq, Claude, embeddings) are intercepted at the network level with MSW, replaying recorded responses. No fixed sleeps, no test retries, no raised timeouts to make CI green. The one exception is an infrastructure failure, below.
- **Lint with Oxlint plus Landmines** (`@interfere/landmines`, recommended config). Any exception goes in the rule's per-file allowlist with a reason, and allowlist counts only go down.
- **Never log note text, transcripts, audio or photos**, in any environment.
- **Secrets never in the repo.** Reference them as `${VAR}`; values live in Windows user environment variables (prefixed `BT_`), cloud environment settings, GitHub repo secrets (prefixed `DEV_` or `PROD_`; no Environments on GitHub Free) or Supabase secrets.
- **The product name, domain and handles come only from config** (`packages/core/src/brand.ts` and the Terraform `product_name` / `domain` variables). Never hard-code "Book Vault".
- **Accessibility target is WCAG 2.2 AA**; axe checks must pass in every Playwright test.
- **Prompts live in versioned files**; any prompt change runs the DeepEval set before and after.

## Working style

- Before a phase or a non-trivial feature, run `/grill-me` and record the outcome as an ADR.
- Prefer CLIs and scripts (gh, supabase, terraform, wrangler, npm) so work runs with or without MCP servers.
- Every document the owner must read (ADRs, briefs, drafts such as the privacy policy) gets the `owner-review` label and a checklist item in the pinned issue "Docs to review" (#163). Add the item in the same PR that adds the document.
- After a debugging detour caused by surprising behaviour, log it in `docs/GOTCHAS.md`: the trap in one bold sentence, then the fix.
- Ponytail is for reviewing PRs, not always on. These non-negotiables win over its advice.
- Claude never merges PRs, triggers workflows (except one infrastructure re-run, below) or pushes to `main`; it opens PRs; the owner merges red ones and the PR risk workflow merges green and yellow ones (ADR 0005, ADR 0009; yellow needs a `## Risk note` section) (enforced by the `block-merges` and `block-github-tool-merges` hooks). Work that depends on an unmerged PR goes on a branch stacked on it.
- Small PRs, one concern each. Every PR passes lint, typecheck, tests and Terraform plan.
- Keep open PRs free of conflicts. During a session, before starting each task and before ending, run `gh pr list --json number,mergeable --jq '.[]|select(.mergeable=="CONFLICTING")'`. For each conflicting PR, merge its base into the branch (merge, never rebase), keep both sides when both added something, regenerate generated files (`npm run generate -w packages/api-contract`) instead of hand-merging them, run lint and typecheck, and push. A conflicting PR is a blocked PR: fix it before you start new work.
- Re-run a CI job once only when it failed for an infrastructure reason: a runner port or Docker clash, a network or registry timeout, a GitHub outage or rate limit, or a job that never started. Use `gh run rerun <id> --failed` (the `block-merges` hook allows it only on a run's first attempt). Before re-running, comment on the PR with the run link and the infra error line. Never re-run a failing test, lint, typecheck or eval: those are real failures to fix. If the same infra failure happens twice, fix its cause (for example, stop old containers before starting the local stack) and log it in `docs/GOTCHAS.md`.
- Fix Dependabot alerts. The `Dependabot alerts to issues` workflow opens one `dependabot` issue per open alert. Sessions fix these after `bug` issues and before new tasks, one alert per PR: bump the direct dependency to a patched version, or, when only a transitive copy is vulnerable and its parent pins it, add an npm `overrides` entry scoped to that parent. Prove it with `npm ls <package>`, then build, lint, typecheck and tests. If no patched version works, comment why on the issue and leave it for the owner to dismiss.
- Every PR with a feature change includes a Playwright video demoing what was done, and/or an explainer video with voice-over whose script is written in ASD-STE100 Simplified Technical English. Videos use seeded test data only (never real notes), and are attached to the PR, not committed.
- Commit early and often: small commits, one logical change each, committed as soon as that change works. Don't batch unrelated changes into one commit.

## Saving tokens

- One topic per session. Carry state in ADRs, briefs, issues and memory, not in one ever-growing conversation: every turn re-sends the whole context.
- Read summaries before details: `git diff --stat`, `gh ... --json --jq`, `gh run view --log-failed`, then only the lines around an error.
- Wait with one blocking command, never repeated status checks.
- Broad reading (reviewing many PRs, researching docs) goes to a subagent or a scheduled run; the desk session decides.
- Scheduled runs use Sonnet and the `terse` skill; save Opus for decisions with the owner.

## What enforces what

Kept by the `correct` skill. A rule with nothing in the right-hand column is a candidate for `/correct`.

| Rule | Enforced by |
| --- | --- |
| No local apply, destroy or deploy | `block-local-deploys` hook |
| No edits to `.env*` or applied migrations | `protect-files` hook |
| Secrets scan before every commit, no skipping the git hook | `guard-commits` hook, git pre-commit hook, CI gitleaks |
| Lint and typecheck after edits | `lint-after-edit` hook, CI |
| Claude never merges, runs workflows or pushes to `main` | `block-merges` and `block-github-tool-merges` hooks, `permissions.deny` |
| CI re-runs only once, only for infrastructure failures | `block-merges` hook (first attempt, `--failed` only); the infra-only part is by hand |
| Only green and yellow PRs merge without the owner | `PR risk` and `Merge green PRs` workflows (ADR 0005, ADR 0009) |
| Open PRs stay free of conflicts | `Update PR branches` workflow merges the base in and labels `conflicts`; sessions fix those by hand |
| Dependabot alerts get fixed | `Dependabot alerts to issues` workflow; sessions fix `dependabot` issues |
| No test doubles, fixed sleeps, retries, raised timeouts or prose comments | Oxlint with Landmines, CI |
| Infrastructure only through Terraform | nightly `drift.yml` |
| Every table has RLS and a cross-user test | pgTAP tests in CI (one per table); nothing yet fails a table without one |

## Environment

- Native Windows at the desk (Claude Code with `cmd /c npx` for stdio MCP servers); Claude Code cloud sessions from the phone.
- Environments: local (Supabase CLI in Docker), dev, production. MCP servers and tokens point at local or dev only, never production.
