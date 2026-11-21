# Run 2: Phase 3 API, the Musts

Brief for an unattended Claude Code cloud session. The owner reviews and merges; you never do.

## Before anything else

1. Read `CLAUDE.md`, `docs/requirements.md`, and every ADR in `docs/adr/` (0001 to 0007). They win over this brief if they disagree. ADR 0007 is the plan for this run.
2. Confirm you are in the `book-tracking-dev` environment, on this repository alone, not in a project thread. If `gh pr merge 1` is not blocked by the `block-merges` hook, stop: the hooks are not running.
3. Find the open issue titled **Run 2 progress**. If none exists, create it with the task list below as checkboxes. Tick each task when its PR is open, with the PR link. This lets a later session pick up where you stopped.

## Running on a schedule

A scheduled task starts a new session every hour. Each session must check the progress issue before doing anything else, so two sessions never work at once:

1. **Finished?** If the progress issue has the `run-finished` label, comment nothing and end the session.
2. **Someone else working?** If it has the `run-active` label and its newest comment starting `Heartbeat` is less than 50 minutes old, end the session without changes.
3. **Claim it.** Otherwise add `run-active` (create the label if needed) and comment `Heartbeat: started, next task N`.
4. **Keep it alive.** Comment `Heartbeat: task N, <what you are doing>` at least every 20 minutes and after each PR.
5. **Hand over.** Before ending for any reason, tick finished tasks, comment `Heartbeat: stopped, next task N, <why>`, and remove `run-active`. Add `run-finished` and post the Finish comment below only when every task and follow-up in the progress issue is done or blocked, **and** no owner request is open: no unanswered review comment on an open PR, no owner instruction in the progress issue still to act on.

Pick up where the last session stopped: read the progress issue and its comments, then the **owner's review comments on every open PR** (`gh pr view N --comments`). Act on owner requests first, then continue with the first unticked task or follow-up that is not blocked. A task with an open PR but failing CI is not done; fix that PR first.

## Keep output short

Follow the `terse` skill. For every yellow or red PR you open, add a risk note with the `risk-note` skill.

- **Terse:** heartbeats, progress-issue comments, your own working notes and replies.
- **Read before you write:** targeted commands (`gh pr checks`, `--json` with `--jq`), not full logs; open only the failing step's log. Read only the files a task touches.
- **Normal, clear sentences** where the owner reads and decides: PR titles and bodies, `needs-owner` issues, review replies, the Finish comment, commit subjects.

## How to work

- One task per PR, small commits, one concern each. Branch from `main`; when a task needs an unmerged PR, stack the branch on that PR's branch and say so in the PR body ("Stacked on #N").
- Every PR passes lint, typecheck, tests, the Terraform job, `plan-dev` and any job it adds. Wait for CI and fix failures before moving on. Never retry, skip or raise timeouts to get green.
- Never merge, push to `main`, trigger workflows or apply Terraform. Merging is what deploys.
- **Contract first:** every endpoint task changes `packages/api-contract/openapi.yaml` in its first commit, then implements in `packages/core`, then the thin handler.
- **Tests:** API tests run against the local stack (`supabase start`, `supabase functions serve`) and validate every response against the spec. Each endpoint has a test that user B cannot read or change user A's data through the API. Paid providers (Groq) are intercepted with MSW replaying recorded responses; record them from invented sample notes only. Never log or record real notes.
- **Videos (ADR 0004):** endpoint PRs carry the voiced ASD-STE100 explainer, showing the requests and responses from a test run on seeded data. Skeleton, infra, schema and tooling PRs say "No demo video" and why.
- PR body: summary, test plan with what you verified, and for `infra/` changes the relevant lines of the `plan-dev` summary.
- Log any surprising-behaviour detour in `docs/GOTCHAS.md`, in the PR where it happened.
- Use Context7 for library docs (Hono, postgres.js, Supabase Edge Runtime, Groq, MSW, DeepEval) and the Terraform MCP server for provider docs instead of guessing APIs.

## When to stop and ask

Open an issue labelled `needs-owner` with the question and your recommended answer, link it from the progress issue, skip the blocked task and anything depending on it, and carry on with the rest. Stop for:

- a decision the ADRs don't cover (do not invent one);
- a missing secret or account, or a permission error from a provider (for example `DEV_GROQ_API_KEY` not set);
- a plan that would destroy or replace an existing resource;
- anything needing a dashboard change, except Clerk, which is the owner's to change;
- a prompt whose DeepEval scores you cannot get to pass with a Groq model (ADR 0007 says Claude only then, and the owner adds that key).

Stop the whole run (after updating the progress issue) when every remaining task is blocked, or when the tasks below are done. Do not start run 3's scope (ask the vault, book summary, quote photo OCR, nudges).

## Tasks

### Foundations

0. **Key check.** `key-check.yml`: nightly, and on PRs that change it or `scripts/key-check/`. For each secret in the key register in `docs/secrets.md`, call the endpoint listed there with the secret and fail on a rejection. Where the provider reports an expiry date (Cloudflare token verify, Grafana access policy tokens), also fail when it is within 14 days. On the nightly run, open or update one issue titled **Key check failed** naming the key and the reason, never the value, and close it when the check passes again. The script is a Node file in `scripts/key-check/`, with a Vitest test for the expiry logic. Keys print only as their names.
1. **`db-migration` skill.** `.claude/skills/db-migration/SKILL.md` from the requirements' skill table and how the Phase 2 migrations were built: new migration only, RLS policy, pgTAP RLS test, seed update, `supabase db reset` and `supabase test db` locally.
2. **Contract skeleton.** `packages/api-contract` workspace: `openapi.yaml` (OpenAPI 3.1, `/v1` server path, bearer security, RFC 9457 problem schema with `code`), `GET /v1/health`, types generated by `openapi-typescript`, and a CI check that the generated types are up to date.
3. **`api` function skeleton.** Hono app built in `packages/core` from injected dependencies; `supabase/functions/api` only wires them. Health endpoint, problem+json errors, a request ID on every response and log line, structured JSON logs that never include note text, the gateway secret header check (`GATEWAY_SECRET`), and the API test harness that validates responses against the spec. CI runs the API tests on changes under `packages/` or `supabase/`.
4. **Auth and database.** Clerk JWT verification against the instance's JWKS; postgres.js through the transaction pooler; every request in a transaction that sets the `authenticated` role and the caller's claims; `users` row created on the first call with `DEFAULT_TIER`. Tests: no token gets 401; a valid token for user B sees none of user A's rows. Tests get real tokens for two test users from the Clerk dev instance with `DEV_CLERK_SECRET_KEY` (Backend API); if that cannot work unattended, stop and ask.
5. **Deploy to dev.** Terraform: the gateway Worker on `workers.dev` forwarding to the `api` function, a `random_password` for `GATEWAY_SECRET`, and Supabase secrets for `GATEWAY_SECRET`, `GROQ_API_KEY` (from `DEV_GROQ_API_KEY`) and `DEFAULT_TIER=plus`. `deploy-dev.yml` runs `supabase functions deploy api` after migrations. Add a synthetic check on the Worker's health URL in the Grafana module.
6. **Plans and limits.** `packages/core/src/plans.ts` with the limits from the requirements' tier table, and a usage-limit module (Vitest) that answers "may this user do X" from the `usage` row, including the 80% warning flag. No endpoint yet.

### Endpoints

7. **Books.** CRUD, statuses, past books (`added_retrospectively`, `finished_on`, `finished_precision`), and `GET /v1/lookup/isbn/{isbn}` from Open Library, with recorded responses in tests. Deleting a book removes its storage objects.
8. **`api-endpoint` skill.** From how tasks 4 and 7 were built: contract first, core logic, thin handler, API and cross-user tests, usage-limit check.
9. **Personal access tokens.** Migration for `api_tokens` (hash only, scopes `sessions:write` and `books:read`, `last_used_at`, revoked) with RLS and its pgTAP test; a `security definer` lookup by hash that returns only the user ID and scopes; `POST`, `GET` and `DELETE /v1/tokens` (the token is shown once); auth accepts a token where its scope allows. Tokens are never logged.
10. **Sessions.** Create with a client-supplied ID (a retry returns the same session), list per book, get, update, delete (removes audio). `POST /v1/sessions/{id}/audio-upload` returns a short-lived signed upload URL, enforcing the longest-note limit from `plans.ts`.
11. **Embedding column.** Migration adding `insights.embedding vector(384)` and its index. Nothing writes it yet.
12. **AI module.** In `packages/core`: interfaces for speech, text and embeddings; Groq clients; prompts in versioned files under `packages/core/prompts/`; the insight-extraction prompt (1 to 5 insights and any quotes, as JSON, only from the user's words); a DeepEval set from invented sample notes; a CI job that runs it on PRs touching `packages/core/prompts/`, with a Groq model as the judge. Pick the cheapest Groq model that passes and record the scores and estimated cost per call in the PR.
13. **Processing.** `POST /v1/sessions/{id}/process` returns `202` and runs transcription (voice only) and extraction in `EdgeRuntime.waitUntil`, moving `status` to `ready` or `failed` with an `error_code`. It updates `usage` (voice seconds, tokens) and enforces voice caps (first 3 books, monthly minutes). On the free tier it deletes the audio after transcription. A failed session can be processed again.
14. **Insights.** List per book and session; add a user insight; edit (keeps `original_text`); delete (the counter trigger fires); pin and unpin.
15. **Finish flow.** Finish a book with rating, review text and a signed upload URL for the finish photo; reflection questions for `mid` and `end` from the user's notes (new prompt with its DeepEval set); save answers.
16. **Past books.** The "what I remember" note becomes insights through the same pipeline; 3 recall prompts (`stage = recall`, new prompt with its DeepEval set).
17. **Search.** `GET /v1/search?q=` across session notes, insights and reviews, ranked, caller's rows only.
18. **Export.** `GET /v1/export?format=json|markdown` per ADR 0007.
19. **iOS Shortcut guide.** `docs/ios-shortcut.md`: create a token, then a Shortcut that records audio, creates a session, uploads with the signed URL and calls `process`, against the dev Worker URL. The owner builds the Shortcut.

## Finish

Comment on the progress issue with: the PRs in merge order (bottom of each stack first), what each deploys when merged, open `needs-owner` issues, the Groq model chosen and its eval scores, and anything you would do differently.
