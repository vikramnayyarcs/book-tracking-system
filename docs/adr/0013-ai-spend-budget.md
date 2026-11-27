# ADR 0013: Per-user monthly AI spend budget

- Status: Accepted
- Date: 2026-11-27
- Decider: Vikram Nayyar
- Method: owner reply on issue #189 ("limit to maybe £5 each, document clearly and can fix later")

## Context

The pre-launch security review (task 5.1, ADR 0010) found three AI routes with no per-user monthly cap (OWASP LLM10, unbounded consumption):

- `POST /v1/quote-photos/{id}/ocr`: one vision call per photo. No usage is recorded and no plan limit applies.
- `POST /v1/books/{id}/reflections`: one text call per book and stage. Tokens are recorded but never checked.
- `POST /v1/sessions` with typed notes, then `/process`: extraction runs on text for any tier. Tokens are recorded but not limited.

`/ask` and voice minutes are already limited. A signed-in free user can run the three routes above in a loop. That can raise the Groq bill, or use up the shared Groq token limit so the AI fails for everyone.

## Decision

Add a per-user monthly AI spend budget of about £5 per tier. Before each AI call, the API checks the user's spend for the month from `app.usage` (`ai_input_tokens` and `ai_output_tokens` are already recorded) and refuses the call when the budget is used up. OCR calls must also record usage, because they record none today.

This is not built yet. It will be built later as a normal contract-first change: `packages/api-contract` first, then the check in `packages/core`, then the thin handlers, with a cross-user test and a Bruno request.

The exact numbers and the per-tier split (Free and Plus) are not final. Confirm them with the owner when the work starts, because the limit changes `PLANS` and the Free and Plus offer.

### Interim mitigation

Until the budget exists:

- A spending cap on the Groq account.
- The per-IP WAF rate limit on the API.

## Consequences

- The cost risk stays open until the budget is built. The Groq spending cap bounds the worst case but cannot tell users apart: one abusive user can still cause an outage for others once the cap is reached.
- The WAF limit is per IP, so a user with several IPs can get around it.
- Revisit sooner if Groq spend or token-limit errors rise during the pilot.
- Follow-up work is tracked in a separate issue that refers to this ADR. Issue #189 stays open until the budget ships.
