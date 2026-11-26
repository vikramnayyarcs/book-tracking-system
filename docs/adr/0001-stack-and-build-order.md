# ADR 0001: Stack and build order

- Status: Accepted; amended by ADR 0012 (MCP server location, build order)
- Date: 2026-11-20
- Decider: Vikram Nayyar

## Context

Book Vault is a private, AI-powered memory for physical books: voice notes per reading session become insights the user can search and question later. It starts as a tool for one reader and should be publishable as a SaaS later. It must be cheap to run at small scale, easy to move to AWS if needed, and built with Infrastructure as Code, CI/CD and good security from the first commit. Full requirements: `docs/requirements.md`.

## Decision

**Stack**

- Monorepo: `apps/web` (React + Vite + TypeScript PWA), `apps/site` (static marketing site), `packages/core` (all business and AI logic), `packages/api-contract` (OpenAPI), `infra/` (Terraform)
- API: Hono on Supabase Edge Functions, behind a Cloudflare Worker gateway and WAF at the api subdomain; the only way clients read or write data
- Data: Supabase Postgres + pgvector with RLS on every table; Supabase Storage with private buckets and signed URLs
- Auth: Clerk, as Supabase third-party auth; Clerk Billing later
- AI: direct provider API (cheapest model that passes evals); Groq (hosted Whisper) for speech-to-text; separate embeddings provider
- Hosting: Cloudflare Pages for both apps; Terraform state in Cloudflare R2
- Observability: Grafana Cloud over OpenTelemetry, Grafana Faro in the PWA
- CI/CD: GitHub Actions; Terraform applies and deploys only run there
- Quality: Oxlint + Landmines, Vitest, API tests on the real local stack, MSW for paid providers (no test doubles), Playwright + axe, DeepEval, k6
- Runtime: Node 24 for tooling and builds; `packages/core` uses web-standard APIs only so it runs on Deno (Edge Functions) and Node (Lambda later)

**Build order**

1. Foundations: IaC and CI/CD
2. Data layer
3. API (OpenAPI contract first; dogfood via an iOS Shortcut)
4. PWA
5. Launch readiness
6. MCP server, as a separate project after launch

## Consequences

- Moving to AWS later is a Postgres dump and restore, S3 for storage, and swapping thin Edge Function wrappers for Lambda; Clerk stays, so no user migration
- The API gateway Worker is required for the WAF to protect the API; the API must reject requests without the gateway's secret header
- Clerk has no official Terraform provider, so its settings are kept in a checklist verified by a CI script
- Backend-first means no usable UI until phase 4; the iOS Shortcut is the guard against losing momentum
- Supabase free-tier limits will shape early load-test results; they are not the design's ceiling
