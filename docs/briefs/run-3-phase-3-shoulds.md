# Run 3: Phase 3 API, the Shoulds

Brief for an unattended Claude Code cloud session. The owner reviews and merges; you never do.

## Before anything else

1. **Is it run 3's turn?** If the issue **Run 2 progress** does not have the `run-finished` label, end the session: run 2's brief still applies.
2. Read `CLAUDE.md`, `docs/requirements.md`, and every ADR in `docs/adr/` (0001 to 0008). They win over this brief if they disagree. ADR 0008 is the plan for this run; ADR 0007 still holds where 0008 does not change it.
3. Confirm you are in the `book-tracking-dev` environment, on this repository alone. If `gh pr merge 1` is not blocked by the `block-merges` hook, stop: the hooks are not running.
4. Find the open issue titled **Run 3 progress**. If none exists, create it with the task list below as checkboxes. Tick each task when its PR is open, with the PR link.

## Running on a schedule

A scheduled task starts a new session every hour. Each session checks the **Run 3 progress** issue before doing anything else, so two sessions never work at once:

1. **Finished?** If it has the `run-finished` label, comment nothing and end the session.
2. **Someone else working?** If it has the `run-active` label and its newest comment starting `Heartbeat` is less than 50 minutes old, end the session without changes.
3. **Claim it.** Otherwise add `run-active` and comment `Heartbeat: started, next task N`.
4. **Keep it alive.** Comment `Heartbeat: task N, <what you are doing>` at least every 20 minutes and after each PR.
5. **Hand over.** Before ending for any reason, tick finished tasks, comment `Heartbeat: stopped, next task N, <why>`, and remove `run-active`. Add `run-finished` and post the Finish comment only when every task is done or blocked **and** no owner request is open on any run 2 or run 3 PR or progress issue.

Pick up where the last session stopped: read the progress issue, then the **owner's review comments on every open PR** (run 2 and run 3), and act on those first. A task with an open PR but failing CI is not done; fix that PR first.

**Keep working.** After each PR, start the next unblocked task straight away; there is no limit on PRs per session. End only when every remaining task is blocked or done, about 50 minutes have passed, or you are about to run out of context. Never end because a PR was opened or CI is running.

## Orchestrate with subagents

The session is an orchestrator and keeps its own context small: schedule rules, heartbeats, the progress issue, owner comments, choosing the next task. Each task goes to one `general-purpose` subagent, given the task's text from this brief (copied, not summarised), the branch to start from, this brief's "How to work" section and the skills to use. It opens the PR, waits for CI with one blocking command, fixes failures, and replies in one line: `PR #N, <green | failing: reason | blocked: reason>`. Mechanical jobs (reading a failed CI log, Bruno files, Context7 lookups) go to a `haiku` subagent. At most 2 workers at once, only on tasks that do not depend on each other, each with `isolation: "worktree"`.

## Keep output short

Follow the `terse` skill. For every yellow or red PR, add a risk note with the `risk-note` skill. Normal, clear sentences where the owner reads and decides: PR titles and bodies, `needs-owner` issues, review replies, the Finish comment, commit subjects.

## How to work

- One task per PR, small commits, one concern each. Branch from `main`; when a task needs an unmerged PR, stack on that PR's branch and say "Stacked on #N" in the body.
- Every PR passes lint, typecheck, tests, the Terraform job, `plan-dev` and any job it adds. Never retry, skip or raise timeouts to get green.
- Never merge, push to `main`, trigger workflows or apply Terraform.
- **Endpoints use the `api-endpoint` skill:** contract first in `packages/api-contract/openapi.yaml`, logic in `packages/core`, thin handler, API test validated against the spec, cross-user test, usage-limit check, and a Bruno request for every new operation.
- **Schema changes use the `db-migration` skill;** `infra/` changes use the `infra-change` skill.
- **Tests:** against the local stack. Groq and push services are intercepted with MSW replaying recorded responses, recorded once from invented notes and invented images only (`GROQ_API_KEY` is set in the cloud environment; `api.groq.com` is allowed). Never record or log real notes, questions, answers, transcripts or photos.
- **Prompts** live in versioned files under `packages/core/prompts/`, each with a DeepEval set; pick the cheapest Groq model that passes and record scores and cost per call in the PR.
- **Videos (ADR 0004):** endpoint PRs carry the voiced ASD-STE100 explainer from a test run on seeded data. Infra, schema and tooling PRs say "No demo video" and why.
- Log surprising-behaviour detours in `docs/GOTCHAS.md` in the PR where they happened.
- Use Context7 for library docs and the Terraform MCP server for provider docs instead of guessing APIs.

## When to stop and ask

Open an issue labelled `needs-owner` with the question and your recommended answer, link it from the progress issue, skip the blocked task and anything depending on it, and carry on. Stop for: a decision the ADRs don't cover; a missing secret, account or network domain; a plan that would destroy or replace an existing resource; any dashboard change (Clerk excepted, which is the owner's); a prompt no Groq model can pass.

Do not start Phase 4 (any PWA screen) or launch-readiness work.

## Tasks

### Foundations

1. **Internal jobs route.** An `/internal/jobs/{job}` route group in the `api` function that rejects any call without a separate secret header (`JOBS_SECRET`, a Terraform `random_password` passed to Supabase secrets). A migration enabling `pg_cron` and `pg_net` and a helper that schedules a job by name. The URL and secret must reach the database through Terraform-managed config (for example Supabase Vault); if no Terraform-managed way exists, stop and ask. Jobs are idempotent. Tests: no secret gets 401; a job run twice does the work once.
2. **Embeddings on write and backfill.** Every insight insert or text edit writes `embedding` through the embeddings interface in core (gte-small, supplied by the Edge wrapper). A `embed-backfill` job, scheduled every 15 minutes, embeds up to a batch of insights with null `embedding`. Tests prove edits re-embed and the backfill is idempotent.

### Endpoints

3. **Ask the vault.** `POST /v1/ask` with a question and an optional `book_id`. Hybrid retrieval (vector similarity plus full-text rank) over the caller's insights only; answer from a new prompt that uses only retrieved notes and cites book and session for each claim; "not in your notes" when nothing relevant is found. Enforces and counts `vaultQuestionsPerMonth`. Never stores or logs the question or answer. DeepEval set: faithfulness, correct citations, the "not in your notes" answer, and no leakage across users.
4. **Book summary.** Plus tier only. When a book is finished, generate the summary in the background into `reviews.summary` from the user's notes only (new prompt with its DeepEval set). `POST /v1/books/{id}/summary` regenerates it. Free tier gets a problem response with code `tier_feature_unavailable`.
5. **Quote photo OCR.** `POST /v1/books/{id}/quote-photos` returns a short-lived signed upload URL to a private bucket; `POST /v1/quote-photos/{id}/ocr` runs a Groq vision model and returns text lines; the photo is deleted after OCR whether it succeeds or fails. Saving the chosen passage uses the insights endpoint with `kind = quote` and a page number (add the column with a migration if it is missing). Record fixtures from a generated image of invented text, never a real book page.
6. **Nudge settings and push subscriptions.** Migration for `push_subscriptions` (endpoint, keys, user) with RLS and its pgTAP test. `POST` and `DELETE /v1/push-subscriptions`. `GET` and `PATCH /v1/me` for `time_zone`, `nudge_time` (null turns nudges off) and "Not reading today" (sets `not_reading_until` to the end of today in the user's time zone).
7. **VAPID keys.** Terraform `tls_private_key` (ECDSA P-256) to Supabase secrets `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`; the VAPID subject comes from config, never a hard-coded name or address. `GET /v1/push/public-key` returns the public key.
8. **Nudge sender.** Migration adding `users.last_nudged_on`. A `nudge` job, scheduled every 15 minutes, finds users whose `nudge_time` fell in the last 15 minutes in their time zone, who have no entry that day, have a book in Reading, have no active `not_reading_until`, and were not nudged today; sends one Web Push per subscription with WebCrypto (RFC 8291 encryption, RFC 8292 VAPID), works on Deno and Node; sets `last_nudged_on`; deletes subscriptions the push service answers with 404 or 410. The payload holds only a title and the Log session link, never note text. Tests cover each skip rule and the once-a-day rule.
9. **Activity calendar.** `GET /v1/activity?year=` returns the dates with at least one entry (a session or a finished-book review) in the user's time zone. No streaks.
10. **Stats.** `GET /v1/stats` for a future visualisation screen: entries per week (last 12 weeks), books finished per month (last 12 months), voice minutes per month, insights and quotes per book, rating distribution, and books by status. No streaks or "missed days". Then open one issue labelled `phase-4` describing the visualisation screen these metrics feed, with a suggested chart per metric. Do not build the screen.
11. **Eval hardening.** At least 5 more invented-note cases per prompt (insights, reflections, recall, summary, ask), covering edge cases: very short notes, notes with quotes, off-topic notes, non-English words. Record before and after scores in the PR.

## Finish

Comment on the progress issue with: the PRs in merge order (bottom of each stack first, including run 2 PRs they stack on), what each deploys when merged, open `needs-owner` issues, models chosen and their eval scores, and anything you would do differently.
