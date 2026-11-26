# Pre-launch security review (2026-11-26)

Task 5.1, ADR 0010. Method: the `vulnerability-scanner` skill over `main` (API, core, database, Edge Function, gateway Worker, workflows, agent config), reading every file on the attack surface, then tracing each lead from source to sink. `npm audit --omit=dev`: 0 vulnerabilities. The web app was reviewed on 2026-11-22 (`2026-11-22-web-scan.md`) and is not repeated. No secrets or note content appear here.

## Attack surface

- Entry points: Hono routes under `/v1` (Clerk JWT or `btp_` personal token), `/internal/jobs/*` (jobs secret, called by pg_cron through pg_net), signed Storage upload URLs.
- Identity: the Worker adds `x-gateway-secret`; the API checks it, verifies the token, and every query runs in a transaction with `role authenticated` and the caller's `sub`, so RLS applies. Personal tokens are hashed (SHA-256) and scoped. They cannot reach routes that do not name a scope, so they cannot create tokens.
- AI: Groq calls for speech, extraction, ask, reflections, summary and OCR. The model has no tools. Its input is the caller's own notes; its output is validated and stored as text.

## Fixed

| # | Severity | Finding | PR |
| --- | --- | --- | --- |
| 1 | Medium (A10:2025, SSRF) | Any signed-in user could store any https URL as a Web Push endpoint. The nudge job then POSTed to it from the edge function, and a 404 or 410 reply deleted the row (a status oracle). Fix: allowlist of browser push services at save and at send, no redirects. | #185 |
| 2 | Medium (LLM10:2026) | Voice minutes and per-note limits used the client-declared length while the file could be 25 MB. A free user could declare 1 second and have a long recording transcribed. Fix: the file must fit 64 KB per declared second, checked before Groq. | #186 |
| 3 | Low to Medium (A06:2025) | Two simultaneous `/process` calls both passed the status check, so Groq ran twice and insights were duplicated. Fix: one atomic `update ... where status in (...)` claim, 409 for the loser. | #187 |

Each started with a failing test. For #186 and #187 the API test runs only in CI (it needs the Clerk-backed local stack); the #187 race was also reproduced against a real Postgres 17 container.

## Needs the owner (issues labelled `needs-owner`)

- #188: the PR risk rules let `packages/core/src/api/app.ts`, `supabase/functions/`, dependency files and `.oxlintrc.json` auto-merge as yellow (agent supply chain).
- #189: no per-user cap on AI cost for photo OCR, reflections and typed-note extraction (LLM10:2026).

## Accepted

1. **The gateway forwards `/internal/*` to the API.** Only the jobs secret protects it (constant-time compare, 401 otherwise). The Worker could block the path, but that is an infra change and no exploit is shown.
2. **The `/ask` quota is checked before and recorded after the model call.** Parallel requests can exceed the monthly cap by the number of parallel requests. Each is one cheap call and the WAF rate limit bounds the parallelism. Accepted until #189 is decided.
3. **The Clerk JWT has no audience or `azp` check.** The issuer is pinned to this Clerk instance, so only tokens Clerk issued for it verify. Revisit if a second app uses the same instance.
4. **`/export` and list routes are unpaginated.** They return only the caller's rows under RLS. Large vaults are a performance concern, not a security one.
5. **Signed upload URLs live 2 hours and can be reused.** The path is fixed on the server to the user and a session or book id, the bucket limits size (25 MB audio, 10 MB photos) and type, and RLS limits reads to the owner.

## Checked, not a problem

- Tenant isolation: every query goes through `asUser`. The `app.users` grants exclude `tier` and `founding_member`, so a user cannot raise their own plan. The `app` schema is not exposed through PostgREST (`config.toml` exposes `public` only). `security definer` functions set `search_path = ''` and are not granted to `anon`. `token_lookup` and `schedule_job` are `service_role` only.
- Storage paths use the verified `sub` plus a UUID or an allowlisted extension; no user text reaches a path.
- SQL: all values are parameters; `sql.unsafe` is only used with constant column lists.
- Prompt injection: the prompts treat notes as data, there are no tools, and `ask` answers are accepted only when the quoted evidence appears in the cited note (`ai/ask.ts`). Model output is stored and rendered as text (see the web scan).
- Book lookup: the ISBN is validated to digits before it goes into the Open Library URL; search text goes through `URLSearchParams`; the base URL is configuration.
- Personal tokens: 256-bit random, hashed at rest, revocable, shown once.
- CORS: explicit origin allowlist, no credentials.
- Workflows: permissions are least privilege. `pull_request_target` (`pr-risk.yml`) checks out the default branch only and reads PR data through the API. PR text is never interpolated into `run:`. The merge workflow refuses forks and other authors.
- Agent config: the `.mcp.json` GitHub server is read-only and its token comes from the environment. No hidden instructions found in skills, prompts or docs.
- Dependencies: no vulnerable production dependency; lockfile committed.

## Not covered

The deployed runtime (Cloudflare WAF rules as applied, Supabase project settings, Clerk dashboard), the iOS Shortcut on a device, and load behaviour (Phase 5 k6 work).
