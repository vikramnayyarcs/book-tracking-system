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
- **No test doubles.** Tests run against the real local stack. Paid third parties (Groq, Claude, embeddings) are intercepted at the network level with MSW, replaying recorded responses. No fixed sleeps, no test retries, no raised timeouts to make CI green.
- **Lint with Oxlint plus Landmines** (`@interfere/landmines`, recommended config). Any exception goes in the rule's per-file allowlist with a reason, and allowlist counts only go down.
- **Never log note text, transcripts, audio or photos**, in any environment.
- **Secrets never in the repo.** Reference them as `${VAR}`; values live in Windows user environment variables (prefixed `BT_`), cloud environment settings, GitHub repo secrets (prefixed `DEV_` or `PROD_`; no Environments on GitHub Free) or Supabase secrets.
- **The product name, domain and handles come only from config** (`packages/core/src/brand.ts` and the Terraform `product_name` / `domain` variables). Never hard-code "Book Vault".
- **Accessibility target is WCAG 2.2 AA**; axe checks must pass in every Playwright test.
- **Prompts live in versioned files**; any prompt change runs the DeepEval set before and after.

## Working style

- Before a phase or a non-trivial feature, run `/grill-me` and record the outcome as an ADR.
- Prefer CLIs and scripts (gh, supabase, terraform, wrangler, npm) so work runs with or without MCP servers.
- After a debugging detour caused by surprising behaviour, log it in `docs/GOTCHAS.md`: the trap in one bold sentence, then the fix.
- Ponytail is for reviewing PRs, not always on. These non-negotiables win over its advice.
- Claude never merges PRs, triggers workflows or pushes to `main`; it opens PRs and the owner merges them (enforced by the `block-merges` and `block-github-tool-merges` hooks). Work that depends on an unmerged PR goes on a branch stacked on it.
- Small PRs, one concern each. Every PR passes lint, typecheck, tests and Terraform plan.
- Every PR with a feature change includes a Playwright video demoing what was done, and/or an explainer video with voice-over whose script is written in ASD-STE100 Simplified Technical English. Videos use seeded test data only (never real notes), and are attached to the PR, not committed.
- Commit early and often: small commits, one logical change each, committed as soon as that change works. Don't batch unrelated changes into one commit.

## Environment

- Native Windows at the desk (Claude Code with `cmd /c npx` for stdio MCP servers); Claude Code cloud sessions from the phone.
- Environments: local (Supabase CLI in Docker), dev, production. MCP servers and tokens point at local or dev only, never production.
