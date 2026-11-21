---
name: api-endpoint
description: Add or change an API endpoint under /v1. Use for any new or changed route, so the contract comes first, the logic lives in packages/core, the handler stays thin, and the cross-user test, usage-limit check and Bruno request are never skipped.
---

# API endpoint

Rules: `CLAUDE.md` non-negotiables, ADR 0007, and `docs/requirements.md`. The worked example is the books endpoints (`packages/core/src/books.ts`, the `/books` routes in `packages/core/src/api/app.ts`, `test/api/books.test.ts`).

## Steps

1. **Contract first.** Edit `packages/api-contract/openapi.yaml` in the first commit: one operation per route with an `operationId`, request and response schemas, and `$ref: "#/components/responses/Problem"` for `401`, `404` and `default`, plus `400` where the body or query can be invalid. Run `npm run generate -w packages/api-contract` and commit the regenerated `src/schema.d.ts` (the `contract:check` CI step fails otherwise). Add any new error `code` to `packages/core/src/api/problem.ts`.
2. **Logic in core.** Put validation, queries and mapping in `packages/core/src/<feature>.ts` as functions that take the request's `sql` (the transaction `withUser` gives you). The database row is snake_case; the API shape is camelCase. Write Vitest tests for the pure parts. Core stays runtime-agnostic: web-standard APIs only. No prose comments.
3. **Thin handler.** Add the route in `packages/core/src/api/app.ts` with the `authenticated` middleware. The handler parses the request, calls core inside `c.var.withUser(...)`, and returns JSON or `problemResponse(...)`. A row that is not the caller's is a `404`, never a `403`. Never put note text, transcripts or tokens in a log line, a problem `detail` or an error message.
4. **Usage limits.** If the route costs money or is capped by tier (voice, AI, vault questions), call the matching function in `packages/core/src/limits.ts` before the work and return `tier_limit_reached` when it says no. Pass the `warn` flag to the client when it is set. Add a Vitest case for both tiers.
5. **Storage.** Objects are removed through the injected `ObjectStore`, never with SQL (`storage.protect_delete` blocks it, see `docs/GOTCHAS.md`). Reject `.` and `..` segments in any client-supplied path.
6. **API tests** in `test/api/<feature>.test.ts`, run against the local stack. Validate every response with `expectMatchesContract(response, method, "/contract/path/{id}")`. Cover: success, invalid input (`400` problem), no token (`401`), and **user B cannot read, list, change or delete user A's data** (`404`). Use `sessionTokenFor("bt-test-alice")` and `"bt-test-bob"` for real Clerk tokens. Clean up test rows by a title prefix. Paid providers are intercepted with MSW in Vitest tests of the core client, replaying recorded responses made from invented notes.
7. **Bruno request.** Add one `.bru` request per operation in `bruno/<resource>/`, with an example body from invented data and no secret values. The CI check fails when an operation in `openapi.yaml` has no matching request.
8. **PR.** One endpoint group per PR. Body: summary, test plan, and the voiced ASD-STE100 explainer video from a test run on seeded data (ADR 0004), or "No demo video" with the reason. Note what you could not run locally.

## Check before pushing

`npm run format:check && npm run lint && npm run typecheck && npm test`. The `api` CI job runs `npm run test:api` against `supabase functions serve`; read its function log step when a request returns 500.
