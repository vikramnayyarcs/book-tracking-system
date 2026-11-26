# ADR 0011: Run 5, Phase 4 Shoulds

- Status: Accepted
- Date: 2026-11-26
- Decider: Vikram Nayyar
- Method: `/grill-me` at the desk (round 1, 2026-11-25) and phone answers on issue #156 (round 2, "Yes to all")
- Amends: ADR 0009 ("Runs", run 5 row)

## Context

Run 4 built the Musts of the PWA (ADR 0009). Run 5 builds the Shoulds. Issue #156 was written while the repository was private and had no CI. The owner has since made the repository public again, so GitHub Actions, CI, auto-merge of green and yellow PRs, deploys and the CI demo videos all work. Some answers in #156 were shaped by that gap.

## Decision

### Scope and order

Scope is the run 5 row of ADR 0009 without the QA agent (it exists and is paused; see ADR 0010). Order of work:

| Task | Item | Notes |
| --- | --- | --- |
| 0 | Bugs #159, then #158 | Only if still open |
| 1 | F14 activity calendar | One "Activity" screen, with the stats below |
| 2 | #101 reading stats | Same screen as F14, no streak counter |
| 3 | F12 export | `GET /v1/export` returns JSON; `packages/core` turns it into Markdown; the PWA downloads a zip with both files |
| 4 | F11 ask the vault | One question, one answer with citations to book and session; no history stored |
| 5 | F9 book summary | Made when a book is finished, shown on the book page, "Write again" button |
| 6 | F7 quote photo | Phone camera picker (`<input capture>`), OCR, select the passage, enter the page number; photo deleted after OCR (ADR 0008) |
| 7 | F15 nudge settings and push | Settings section: on/off, time picker, "Not reading today"; explains that iPhone push needs the app on the home screen |
| 8 | #93 endpoint videos | Books and sessions explainer videos, following the recommendation in #93 |

Each screen follows the `pwa-screen` skill and ships a demo video.

### Answers from #156

| Q | Topic | Outcome |
| --- | --- | --- |
| 1 | Checks inside the session | Kept as an extra habit: each session runs lint, typecheck and the affected tests before opening a PR and says so in the PR body. CI is now the gate |
| 2 | Cap open PRs | Kept: no new task starts while 5 of the run's PRs are open and unmerged |
| 3 | Videos pending | No longer applies while the repository is public. CI records the demo videos. If the repository goes private again, PRs say "video pending" |
| 4 | F14 and #101 on one screen | Accepted |
| 5 | Export | Accepted as listed above |
| 6 | Ask the vault | Accepted as listed above |
| 7 | Book summary | Accepted as listed above |
| 8 | Quote photo | Accepted as listed above |
| 9 | Nudge settings | Accepted as listed above |

### Other changes since #156

- **Task 0** is now bugs #159 (deploy fails when `plan-dev` holds the state lock) and #158 (avatar and sign-out in the app shell). The old task 0 (#153, #154) is done.
- **Auto-merge is back.** Green and yellow PRs merge by themselves when checks pass (ADR 0009). PRs that touch `docs/adr/`, `docs/briefs/`, `docs/requirements.md`, `packages/core/src/api/auth.ts` or `apps/web/public/_headers` stay red.
- **Push keys.** The VAPID keys already come from Terraform (`tls_private_key.vapid`). F15 needs no owner step and no one-time script. The "push keys via a one-time script" line in #156 is replaced by this.
- **Build routine.** It fires hourly and ends at once when there is no work.
- **Stop point.** The run stops after run 5 finishes. Run 6 starts only from the run 6 brief.

## Consequences

- The owner reviews only red PRs again, so run 5 moves at CI speed. Run 5 touches `supabase/` and the contract, so more PRs are red or yellow than in run 4.
- The cap of 5 open PRs slows the run when the owner is away. Accepted, to keep the review queue small.
- F11 and F9 add AI prompts. Each prompt lives in a versioned file and runs the DeepEval set before and after (CLAUDE.md).
- F15 depends on iOS web push, which works only for a home-screen PWA. Failure on iPhone is a known limit, not a bug.
- Revisit if: the repository goes private again (Q1 and Q3 apply again), or the cap leaves the run idle for days.
