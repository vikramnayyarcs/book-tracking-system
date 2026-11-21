# ADR 0008: Run 3, the Phase 3 Shoulds

- Status: Accepted
- Date: 2026-11-21
- Decider: Vikram Nayyar
- Method: short `/grill-me` round at the desk, before an overnight unattended run
- Amends: ADR 0007 ("Run 3 starts only after the owner has reviewed run 2's PRs")

## Context

ADR 0007 put ask the vault, book summary, quote photo OCR and nudge scheduling in run 3, but left the OCR provider, the nudge mechanism and the run's start condition open. The owner wants the unattended routine to keep producing PRs overnight without waiting for reviews.

## Decision

### Start condition

Run 3 starts as soon as the **Run 2 progress** issue has the `run-finished` label. Its branches stack on unmerged run 2 PRs where needed. Each session still acts on the owner's review comments on open run 2 and run 3 PRs before new work. This replaces ADR 0007's rule that run 3 waits for the owner's review.

### Scope

| Feature | Decision |
| --- | --- |
| Ask the vault (F11) | Hybrid retrieval over the caller's insights (vector on `insights.embedding` plus the existing full-text columns), answer from a Groq model citing book and session, and a plain "not in your notes" answer when nothing relevant is found. Questions and answers are **never stored and never logged**; only the monthly count in `usage` is kept. |
| Embeddings | Every insight is embedded when it is written or edited (Supabase built-in `gte-small`, per ADR 0007). A scheduled backfill embeds any insight whose `embedding` is null. |
| Book summary (F9) | Plus tier only (`plans.ts`). Generated in the background when a book is finished, into `reviews.summary`, from the user's notes only; can be regenerated. Free tier gets a problem response with a stable code. |
| Quote photo (F7) | Signed upload to a private bucket, OCR by a Groq vision model returning text lines, then the **photo is deleted** whether OCR succeeds or fails. The client picks the passage and saves it as a quote with a page number. |
| Daily nudge (F15) | At most **one push a day per user**, at the user's chosen time, only when they have no entry that day, have a book in Reading, and have not set "Not reading today". A `pg_cron` job every 15 minutes calls an internal `api` route (secret header) that finds the users who are due; `last_nudged_on` stops a second nudge. Web Push is sent from `packages/core` with WebCrypto (no Node-only modules). VAPID keys come from Terraform (`tls_private_key`, P-256) into Supabase secrets. The push payload has no note text. |
| Activity calendar (F14) | API only: the days with at least one entry for a year, in the user's time zone. No streaks, no gaps counted. |
| Stats | API only: metrics for a future visualisation screen (activity over time, books finished, voice minutes, insights and quotes per book, ratings, status counts). No streaks or "missed days" metrics. The screen is Phase 4. |
| Eval hardening | More invented-note DeepEval cases for every prompt. |

### Unchanged

Everything else in ADR 0007 holds: Groq first (Claude only if no Groq model passes the evals), contract first, thin handlers, MSW for Groq and push services, invented notes only, no test doubles.

## Consequences

- The owner may review a deep stack in the morning; a change requested low in the stack can mean rework above it.
- The visualisation screen and calendar UI wait for Phase 4, but their data shapes are fixed now; Phase 4 may ask for contract changes.
- A scheduled database job and an internal route are new moving parts: the internal route must reject any call without the secret, and the job must be idempotent.
- Deleting quote photos after OCR means a bad OCR result needs a new photo.
