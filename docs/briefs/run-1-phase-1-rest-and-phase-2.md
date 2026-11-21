# Run 1: finish Phase 1, then build Phase 2

Brief for an unattended Claude Code cloud session. The owner reviews and merges; you never do.

## Before anything else

1. Read `CLAUDE.md`, `docs/requirements.md`, and every ADR in `docs/adr/` (0001 to 0004). They win over this brief if they disagree.
2. Confirm you are in the `book-tracking-dev` environment, on this repository alone, not in a project thread. If `gh pr merge 1` is not blocked by the `block-merges` hook, stop: the hooks are not running.
3. Find the open issue titled **Run 1 progress**. If none exists, create it with the task list below as checkboxes. Tick each task when its PR is open, with the PR link. This lets a later session pick up where you stopped.

## Running on a schedule

A scheduled task starts a new session every hour. Each session must check the progress issue before doing anything else, so two sessions never work at once:

1. **Finished?** If the progress issue has the `run-finished` label, comment nothing and end the session.
2. **Someone else working?** If it has the `run-active` label and its newest comment starting `Heartbeat` is less than 50 minutes old, end the session without changes.
3. **Claim it.** Otherwise add `run-active` (create the label if needed) and comment `Heartbeat: started, next task N`.
4. **Keep it alive.** Comment `Heartbeat: task N, <what you are doing>` at least every 20 minutes and after each PR.
5. **Hand over.** Before ending for any reason, tick finished tasks, comment `Heartbeat: stopped, next task N, <why>`, and remove `run-active`. When Phase 2 is done or every remaining task is blocked, add `run-finished` and post the Finish comment below.

Pick up where the last session stopped: read the progress issue, its comments and open PRs, and continue with the first unticked task that is not blocked. A task with an open PR but failing CI is not done; fix that PR first.

## Keep output short

Nobody reads a scheduled run live, so spend tokens on the work, not on narration.

- **Terse:** heartbeats, progress-issue comments, your own working notes and replies. One line each, fragments fine: `Heartbeat: task 20, fixing usage grants, CI running`. No summaries of what you just did, no restating the plan, no pleasantries.
- **Read before you write:** check CI and issue state with targeted commands (`gh pr checks`, `--json` with `--jq`), not full logs; open only the failing step's log.
- **Normal, clear sentences** where the owner reads and decides: PR titles and bodies, `needs-owner` issues, review replies, the Finish comment, commit subjects. Keep these short too; no padding.

## How to work

- One task per PR, small commits, one concern each. Branch from `main`; when a task needs an unmerged PR, stack the branch on that PR's branch and say so in the PR body ("Stacked on #N").
- Every PR passes lint, typecheck, tests, the Terraform job, `plan-dev` and any job it adds. Wait for CI and fix failures before moving on. Never retry, skip or raise timeouts to get green.
- Never merge, push to `main`, trigger workflows or apply Terraform. Merging is what deploys.
- PR body: summary, test plan with what you verified, and for `infra/` changes the relevant lines of the `plan-dev` summary.
- Feature PRs (the site in this run) carry the demo and explainer videos from ADR 0004. Infra, tooling and schema PRs say "No demo video" and why.
- Log any surprising-behaviour detour in `docs/GOTCHAS.md`, in the PR where it happened.
- Use Context7 for library docs and the Terraform MCP server for provider docs instead of guessing APIs.

## When to stop and ask

Open an issue labelled `needs-owner` with the question and your recommended answer, link it from the progress issue, skip the blocked task and anything depending on it, and carry on with the rest. Stop for:

- a decision the ADRs don't cover (do not invent one);
- a missing secret or account, or a permission error from a provider;
- a plan that would destroy or replace an existing resource;
- anything needing a dashboard change, except Clerk, which is also the owner's to change.

Stop the whole run (after updating the progress issue) when every remaining task is blocked, or when Phase 2 is done. Do not start Phase 3: it has no ADR yet.

## Tasks

### Phase 1 (ADR 0002)

1. **`infra-change` skill.** `.claude/skills/infra-change/SKILL.md` from the requirements' skill table and how `github-repo` and the dev root were built: new module, fmt, validate, providers lock for both platforms, `plan-dev` review, never a dashboard change.
2. **Brand config.** `packages/core` as an npm workspace with only `src/brand.ts` (product name, tagline, waitlist URL placeholder, handles) and its package.json with explicit exports. Nothing else in core yet.
3. **Marketing site.** `apps/site` (Astro, static): one page with the name and tagline from `brand.ts`, a short "private by default" note, and the waitlist link. WCAG 2.2 AA. No cookies, no analytics yet.
4. **Playwright and axe.** A smoke test for the site with an axe check, run in CI. This is the pattern every later Playwright test follows.
5. **PR video pipeline.** Per ADR 0004: Playwright records the demo, Piper voices an ASD-STE100 script, ffmpeg joins them, CI uploads the MP4 as an artifact and the PR links it. Include the script lint (sentence length, one instruction per sentence). Use it on task 3's site as the first real video; stack on 3 and 4.
6. **Cloudflare Pages.** Module for Pages projects; `site-dev` in the dev root (direct upload, `pages.dev`). `deploy-dev.yml` builds `apps/site` and deploys it with `wrangler pages deploy` when the site changes. Write the zone module (DNS, custom domains, WAF custom rules, rate limiting) but keep it off until `var.domain` is set.
7. **Supabase dev project.** Module creating the dev project (`eu-west-2`, free) with a `random_password`, writing `DEV_SUPABASE_PROJECT_REF`, `DEV_SUPABASE_URL`, `DEV_SUPABASE_DB_PASSWORD` and the API keys to repo secrets; `supabase_third_party_auth` for Clerk from `DEV_CLERK_FRONTEND_API_URL`. The access token is organization-scoped (new Supabase token type); if the provider rejects it, stop and ask. No hand-made projects exist.
8. **Grafana.** Module that **imports** the existing stack (`GRAFANA_STACK_SLUG`, never creates one), an access policy and token for OTLP writes (secrets `GRAFANA_OTLP_ENDPOINT`, `GRAFANA_OTLP_INSTANCE_ID`, `GRAFANA_OTLP_TOKEN`), and a synthetic HTTP check on the `site-dev` URL. Stack on 6.
9. **Drift check.** `drift.yml`: nightly plan of dev; opens or updates one issue when the plan is not empty.
10. **Production root and release workflow.** `infra/envs/prod` sharing the modules (no repo-settings ownership, which stays in dev), validated in CI, never planned against real state yet. `release-prod.yml`: manual, fails unless the repo variable `PROD_ENABLED` is `true`.
11. **Clerk checklist and check.** `infra/clerk-checklist.md` with the settings in ADR 0003. A CI job that reads the instance's settings with `DEV_CLERK_SECRET_KEY` and fails on a mismatch. Find out whether the Clerk CLI's `config pull` works with a secret key; if not, use Clerk's Backend API.
12. **GitHub MCP server.** Add GitHub's remote MCP server to `.mcp.json`, authenticated with `${BT_GITHUB_MCP_TOKEN:-}` so sessions without the variable still start. Update `docs/cloud-environment.md`.

### Phase 2 (ADR 0003)

13. **Local Supabase stack in CI.** `supabase init` (`supabase/config.toml`), Supabase CLI as a pinned dev dependency, and a CI job that on changes under `supabase/` runs `supabase start`, `supabase db reset` and `supabase test db`.
14. **`app` schema and `users`.** First migration: `app` schema not exposed to the Data API, helper for the caller's `sub`, `users` with RLS, grants to `authenticated` only, and a pgTAP test proving alice cannot see or change bob's row.
15. **`books`**, with RLS and its pgTAP test (select, insert, update, delete across users).
16. **`sessions`**, same.
17. **`insights`**, same.
18. **`reflections`**, same.
19. **`reviews`**, same.
20. **`usage`**, same, plus the trigger that counts deleted AI insights.
21. **Search and pgvector.** Generated English `tsvector` columns and GIN indexes; enable `vector`. Tests that a search finds only the caller's rows.
22. **Storage.** `audio` and `photos` buckets with limits and types from ADR 0003, policies on the first path segment, pgTAP tests for cross-user access.
23. **Seed data.** `supabase/seed.sql`: alice and bob with invented books, sessions, insights, reflections and a review each. Never real notes.
24. **Migrations to dev.** `deploy-dev.yml` runs `supabase db push` against dev after Terraform, using the secrets from task 7. Stack on 7.

## Finish

Comment on the progress issue with: the PRs in merge order (bottom of each stack first), what each deploys when merged, open `needs-owner` issues, and anything you would do differently.
