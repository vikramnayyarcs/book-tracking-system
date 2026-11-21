# Gotchas

Log a trap the moment a debugging detour ends, so nobody (human or AI) hits it twice. Newest first.

## 2026-11-21: deploying a function needs `--yes` in CI
**Supabase CLI 3.x asks for confirmation before deploying a function; in CI (no terminal) it prints "Nothing was changed" and exits 1, so every dev deploy after 18:19 failed without deploying the API.**
Fix: pass `--yes`, as the migrations job's `db push` already does.

Format:

```
## YYYY-MM-DD: short title
**The trap in one bold sentence.**
Fix: what to do instead.
```

## 2026-11-21: Supabase CLI v3 `db push` targets the local database by default
**In CLI v3, `supabase db push` pushes to the local stack unless told otherwise, so after `supabase link` in CI it fails with "connect ECONNREFUSED 127.0.0.1:54322".**
Fix: `supabase db push --remote --yes`. `--remote` targets the linked project (`--linked` is deprecated) and `--yes` confirms the hosted change in a non-interactive run. Seed files are pushed only with `--include-seed`.

## 2026-11-21: Cloud image's Node 22 shadows the pinned Node 24
**In cloud sessions `/opt/node22/bin` comes before `/usr/local/bin` on PATH, and npm's `#!/usr/bin/env node` shebang picks that Node 22 even when you call `/usr/local/bin/npm`, so `npm ci` failed the `engines` check and stopped the setup script.**
Fix: `scripts/cloud-setup.sh` puts `/usr/local/bin` first on its own PATH, links `node`, `npm`, `npx` and `corepack` in any earlier folder to the pinned ones, and adds `/usr/local/bin` to the front of PATH through `CLAUDE_ENV_FILE`.

## 2026-11-21: Supabase provider orphans a project when legacy_api_keys_enabled is set
**With `legacy_api_keys_enabled = true`, `supabase_project` creates the project, then fails a second call ("JWT based legacy (anon, service_role) API keys are already enabled"), so Terraform never records the project and the next apply fails with "already exists".**
Fix: leave `legacy_api_keys_enabled` unset (it is deprecated, and legacy keys are on by default for new projects). Adopt an orphaned project with an `import` block using its project ref; resources created earlier in the failed apply, such as `random_password`, are already in state.

## 2026-11-21: Cloud sessions can use GitHub tools that Bash hooks never see
**Claude Code cloud sessions have built-in GitHub MCP tools (`mcp__github__*`, including merge and workflow tools), and a PreToolUse hook matched on `Bash|PowerShell` does not run for them.**
Fix: guard MCP tools separately. `block-github-tool-merges` matches `mcp__github__.*`, and `permissions.deny` in `.claude/settings.json` lists the merge and workflow tools.

## 2026-11-20: R2 must be enabled by hand, and its S3 endpoint lags
**Creating an R2 bucket fails with 403 "Please enable R2 through the Cloudflare Dashboard" (code 10042) until R2 is switched on for the account, and right after that the account's S3 endpoint fails TLS handshakes for about 30 seconds.**
Fix: enable R2 once in the dashboard (R2 Object Storage, Get started); it is an account sign-up step, not a setting Terraform can manage. The bootstrap workflow retries the state migration for up to a minute to ride out the endpoint delay.

## 2026-11-20: Old gh versions fail on pr edit and pr view
**`gh` 2.51 and earlier fail on `gh pr edit` and some `gh pr view` calls with "Projects (classic) is being deprecated", because they still query a removed GraphQL field.**
Fix: `winget upgrade GitHub.cli`. Until then, use the REST API, for example `gh api -X PATCH repos/<owner>/<repo>/pulls/<n> -f base=main`. In Git Bash, drop the leading slash from `gh api` paths, or they are rewritten as Windows file paths.

## 2026-11-20: VS Code opened from GitHub Desktop keeps an old PATH
**VS Code launched from GitHub Desktop ("Open in Visual Studio Code") inherits GitHub Desktop's environment, so tools installed after GitHub Desktop started (winget installs, PATH edits) stay invisible to Claude Code, its hooks and its MCP servers, even after restarting VS Code.**
Fix: quit GitHub Desktop and VS Code, then reopen. Check with `gitleaks version` in a new VS Code terminal. Symptoms: hooks report a tool as missing, or an MCP server fails with "Connection closed".

## 2026-11-20: Stacked PRs merge into their base branch, not main
**A PR whose base is another PR's branch merges into that branch; if the lower PR merged first and its branch was not deleted, the upper PR's commits never reach `main`.**
Fix: after a lower PR merges, retarget the next one with `gh pr edit <n> --base main` before merging it. "Automatically delete head branches" in repo settings (managed by Terraform) makes GitHub retarget automatically.

## 2026-11-21: `clerk config pull` cannot run in CI with a secret key
**The Clerk CLI's `config pull` talks to Clerk's Platform API and needs a browser (OAuth) login; `CLERK_SECRET_KEY` only unlocks `clerk api` (the Backend API), so a CI job built on `config pull` fails.**
Fix: `scripts/clerk/check.ts` reads `GET /v1/instance` with the secret key and the public Frontend API `GET /v1/environment`, and compares them with `infra/clerk-checklist.md`. The Supabase integration cannot be read through either API, so it stays a manual checklist item.

## 2026-11-21: Storage blocks direct deletes from `storage.objects`
**A `delete from storage.objects` in SQL raises "Direct deletion from storage tables is not allowed" (trigger `storage.protect_delete`), so a pgTAP test of the delete policy fails before RLS is even checked.**
Fix: in the test, run `set local storage.allow_delete_query = 'true';` before the delete. The API deletes objects through the Storage API, never with SQL. The storage policies check only the first path segment, so a name such as `alice/../bob/x` stays in alice's folder; the Phase 3 API must reject `.` and `..` segments.

## 2026-11-21: `astro preview` backgrounds itself in agent sessions
**Astro 7 starts `astro preview` as a background daemon when it detects an AI agent session (for example Claude Code), so the command exits at once and Playwright's `webServer` fails with "Process from config.webServer exited early".**
Fix: pass `--ignore-lock` (`playwright.config.ts` does), which keeps the server in the foreground. Stop a stray daemon with `npx astro preview stop` from `apps/site`.

## 2026-11-21: local Supabase stack will not start in cloud sessions
**The cloud session cannot start the local Supabase stack, because the agent proxy blocks the ghcr.io image blobs.** Run the pgTAP and API tests in CI; locally, check the harness against a Node shim of the Hono app.

## 2026-11-21: the edge wrapper is not typechecked
**`supabase/functions/api/index.ts` runs on Deno, so `npm run typecheck` does not cover it, and a missing import shows up only as a runtime `ReferenceError` in `supabase functions serve`.**
Fix: after editing the wrapper, check every identifier it uses is imported; the `api` CI job prints the last 40 lines of the function log when the function does not start.

## 2026-11-21: `npm:postgres` does not work in Supabase Edge Functions
**postgres.js from npm fails in the Edge Runtime with `ERR_NOT_IMPLEMENTED: LibuvStreamWrap.prototype.useUserBuffer`, so every query returns a 500.**
Fix: the function's `deno.json` import map points `postgres` at the Deno build, `https://deno.land/x/postgresjs`, which has the same API. Node (tests, tooling) still uses the npm package.

## 2026-11-21: DeepEval usefulness scores swing between judges

**The same extraction scored 0.3 to 1.0 per sample on usefulness depending on the Groq judge, while faithfulness stayed at 1.0 everywhere.** `packages/core/evals/run_evals.py` fails a run on any faithfulness, count, quote or verbatim-quote miss, and on a usefulness mean below 0.5, not on single usefulness scores. The Groq free tier also answers 429 often during a run; the judge waits for `Retry-After` and continues.

**Supabase signed upload URLs are valid for two hours and the time cannot be changed.** The API reports `expiresInSeconds: 7200` and the real limit on how long a client may upload is the tier's longest note, checked when the URL is requested.

## 2026-11-21: the Open Library fixture is a verbatim recording of a public catalogue record

**`packages/core/src/fixtures/open-library-isbn.json` is the live response for ISBN 9780140328721, not hand-written data; an invented ISBN returns no record, so the lookup cannot be recorded from one.** The record holds public catalogue data only, no user data. Record it again with `curl -sL "https://openlibrary.org/api/books?bibkeys=ISBN:9780140328721&format=json&jscmd=data"` when the API shape changes.

## 2026-11-21: MSW cannot catch a `fetch` that a client captured before `server.listen()`

**A client built with `fetch: f = fetch` keeps the original `fetch`, so tests that construct it at module or `describe` level skip the MSW handlers and hit the real network.** The Groq clients now default to `(input, init) => fetch(input, init)`, which reads the global at call time.

## 2026-11-21: `excluded.col` in an upsert needs SELECT on that column
**`insert ... on conflict do update set x = excluded.x` fails (a 500 from the API) when the role has column-limited grants and no `select` on `x`, because reading `excluded.x` counts as reading the column.**
Fix: set the column from the bound parameter (`set x = ${value}`) instead of `excluded.x`; see `savePushSubscription` in `packages/core/src/nudge.ts`.
