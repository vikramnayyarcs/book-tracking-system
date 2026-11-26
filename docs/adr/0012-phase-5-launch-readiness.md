# ADR 0012: Phase 5, launch readiness (and the later phases)

- Status: Accepted
- Date: 2026-11-26
- Decider: Vikram Nayyar
- Method: `/grill-me` at the desk (2026-11-25 and 2026-11-26); outcome recorded in issue #160
- Amends: ADR 0001 (build order, MCP server location) and `docs/requirements.md` ("Implementation order", "Out of scope")

## Context

Phase 4 is built. Phase 5 makes the product safe to give to a small group of real users. The public name and domain are not chosen yet, and the owner wants to start without them. ADR 0001 and the requirements said the MCP server is a separate repository after launch.

## Decision

### Phase 5 is split in two

| Part | Needs name or domain | Contents |
| --- | --- | --- |
| 5a | No | Account deletion, privacy policy draft, Grafana alerts and dashboard, production review |
| 5b | Yes, later | Domain through Cloudflare Registrar, production Clerk instance, WAF rules and rate limit, full marketing site, launch |

5a is run 6 (`docs/briefs/run-6-phase-5a-launch-prep.md`). 5b gets its own grill and brief once the owner picks it up; the domain is deprioritised.

### Launch rules

- **Launch free.** Clerk Billing, founding members and the donation link wait until the owner has logged two full books. The limits in `plans.ts` stay enforced.
- **Repository stays public for now**, so GitHub Actions run (issue #155 is closed).
- **Invite-only beta** of about 10 people from the Substack waitlist, with Clerk sign-up mode set to Restricted.

### Account deletion: `DELETE /v1/me`

Immediate and permanent. Protections, all required:

- Clerk session token only. Personal access tokens always get 403.
- A verified user with a recent sign-in (Clerk reverification, within 10 minutes).
- An "are you sure" step: the user types a confirmation word, sent in the request body.
- At most 3 attempts per user per day.
- Rows are deleted in one transaction, then storage objects, then the Clerk user, retrying until all are gone.
- The log line holds the user ID and time only.
- Tests: user A can never delete user B; a PAT gets 403; a stale session is refused.
- Settings offers "Export your data first" (F12) before the confirmation.

### Privacy policy

Claude drafts it from the real data flows: Clerk, Supabase (eu-west-2), Groq, the embeddings provider, Grafana and Cloudflare. It is published on the marketing site and linked from sign-in. The draft carries the `owner-review` label; the owner approves the final text.

### Owner review flag

Every document the owner must read (privacy policy, ADRs, briefs, marketing copy) gets the `owner-review` label. One pinned issue, "Docs to review", lists them as a checklist.

### Alerts and dashboard

Terraform-managed Grafana alerts, by email only: API 5xx rate, p95 latency, AI usage spike (cost guard), nudge job failure, Edge Function errors. One dashboard shows all of them.

### Production review (before the first invite)

1. The deeper `vulnerability-scanner` security review (ADR 0010).
2. A k6 load test in **dev** at about 10 times beta traffic on non-AI routes, and only a light sample on AI routes (real Groq spend). Production gets a 1-minute smoke test only.
3. The DeepEval set against production's model.
4. A Supabase restore drill.
5. The owner signs off in a red PR.

### Name (5b only)

The working public name is **Shelfmind**, with the tagline **"So your reading never gets lost"** (the owner asked Claude to pick). "Book Box" is rejected: it clashes with the App Store app "Bookbox – review, remember". The name is applied through `packages/core/src/brand.ts` and the Terraform `product_name` variable in 5b, after a UK trademark check and before buying the domain. Nothing in 5a uses the name or the domain, and the name does not appear in ADRs, code or briefs as a hard-coded string.

### Later phases

| Phase | Contents | Gate |
| --- | --- | --- |
| 6 | MCP server, in this repository as `apps/mcp`. It calls the API like any client and may be hosted elsewhere | 20 or more books of real notes, after its own grill |
| 7 | AI chat and agent features: vault-wide chat, conversational reflection, save as insight | Same gate, after its own grill |

This reverses "the MCP server lives in its own repo" in ADR 0001 and `docs/requirements.md`. Reason: one repository keeps the contract, types and CI in one place.

### Run numbers

Run 6 is Phase 5a. It starts only after **Run 5 progress** has the `run-finished` label. The run 5 brief and ADR 0011 cover the Phase 4 Shoulds. Phase 6 and 7 are numbered as phases, not runs; their runs get numbers when planned.

## Consequences

- Beta can start without a name or domain. The cost is that the privacy policy and marketing site wait for 5b to go public.
- Hard delete is final. Protections in layers reduce the chance of an accidental or hostile delete, but a user who confirms loses everything. Export is offered first.
- The deletion order (rows, storage, Clerk) means a partial failure can leave a Clerk user with no data; the retry loop and the user-ID log line make that visible.
- `apps/mcp` makes the monorepo bigger and adds a workspace to CI. Its hosting and security review stay separate.
- Revisit if: the owner reaches 20 books sooner than expected, or the invite-only beta shows deletion is too hard to find or too easy to trigger.
