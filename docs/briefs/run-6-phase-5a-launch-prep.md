# Run 6: Phase 5a, launch prep

Brief for an unattended Claude Code cloud session. Red PRs wait for the owner; green and yellow PRs merge automatically when every check passes (ADR 0009). You never merge. ADR 0012 is the plan for this run.

## Before anything else

1. **Is it run 6's turn?** If the issue **Run 5 progress** does not have the `run-finished` label, end the session.
2. Read `CLAUDE.md`, `docs/requirements.md`, and every ADR in `docs/adr/` (0001 to 0012). They win over this brief if they disagree. ADR 0012 is the plan for this run.
3. Confirm you are in the `book-tracking-dev` environment, on this repository alone. If `gh pr merge 1` is not blocked by the `block-merges` hook, stop: the hooks are not running.
4. Find the open issue titled **Run 6 progress**. If none exists, create it with the task list below as checkboxes. Tick each task when its PR is open, with the PR link.

## Running on a schedule

A scheduled task starts a new session every hour and ends at once when there is no work. Each session checks the **Run 6 progress** issue first, so two sessions never work at once:

1. **Finished?** If it has the `run-finished` label, comment nothing and end the session.
2. **Someone else working?** If it has the `run-active` label and its newest comment starting `Heartbeat` is less than 50 minutes old, fix any PR labelled `conflicts`, then end the session.
3. **Claim it.** Otherwise add `run-active` and comment `Heartbeat: started, next task N`.
4. **Keep it alive.** Comment `Heartbeat: task N, <what you are doing>` at least every 20 minutes and after each PR.
5. **Hand over.** Before ending for any reason, tick finished tasks, comment `Heartbeat: stopped, next task N, <why>`, and remove `run-active`. Add `run-finished` and post the Finish comment only when every task is done or blocked **and** no owner request is open on any run 6 PR or the progress issue.

**Cap on open PRs.** Do not start a new task while 5 of this run's PRs are open and unmerged.

**Order of work every session (ADR 0010):** (1) PRs labelled `conflicts` or showing as conflicting, (2) owner review comments on open PRs, (3) open PRs with failing CI, (4) `security` issues of high or critical severity, (5) `bug` issues, (6) `dependabot` issues, (7) other `security` issues, (8) the next task. Each fix starts with a failing test that proves the problem.

**Keep working.** After each PR, start the next unblocked task straight away, unless the cap applies. End only when every remaining task is blocked or done, about 50 minutes have passed, or you are about to run out of context.

## Orchestrate with subagents

The session is an orchestrator and keeps its own context small. Each task goes to one `general-purpose` subagent, given the task's text from this brief (copied, not summarised), the branch to start from, this brief's "How to work" section and the skills to use. It opens the PR, waits for CI with one blocking command, fixes failures, and replies in one line: `PR #N, <green | failing: reason | blocked: reason>`. Mechanical jobs go to a `haiku` subagent. At most 2 workers at once, only on tasks that do not depend on each other, each with `isolation: "worktree"`.

## Keep output short

Follow the `terse` skill. Every yellow or red PR body has a `## Risk note` section from the `risk-note` skill. Normal, clear sentences where the owner reads and decides.

## How to work

- GitHub GraphQL is blocked in cloud sessions: use REST through `gh api repos/vikramnayyarcs/book-tracking-system/...`.
- One task per PR, small commits, one concern each. Branch from `main`; stack on an unmerged PR only when needed, and say "Stacked on #N".
- Before opening a PR, run lint, typecheck and the affected tests in the session and say so in the PR body. Every PR also passes CI, including the Terraform job and `plan-dev`. Never retry, skip or raise timeouts to get green.
- Never merge, push to `main`, trigger workflows or apply Terraform.
- API changes use `api-endpoint`; schema changes use `db-migration`; `infra/` changes use `infra-change`; screens use `pwa-screen`. The contract changes first.
- **Tests:** real local stack; seeded users and invented data only. Never record or log real notes, transcripts, audio or photos.
- **Videos:** feature PRs add a `demo` Playwright test and a `docs/videos/<feature>.txt` script in ASD-STE100. Infra, docs and tooling PRs say "No demo video" and why.
- **Owner-review documents** (privacy policy draft, ADRs, briefs) get the `owner-review` label and a line in the pinned issue "Docs to review".
- Log surprising-behaviour detours in `docs/GOTCHAS.md`.
- Use Context7 and the Terraform MCP server for docs instead of guessing.

## When to stop and ask

Open an issue labelled `needs-owner` with the question and your recommended answer, link it from the progress issue, skip the blocked task and anything depending on it, and carry on. Stop for: a decision the ADRs don't cover; a missing secret, account, token scope or network domain (for example Clerk reverification settings, or Grafana alert contact email); a plan that would destroy or replace an existing resource; any dashboard change (Clerk is the owner's).

**Do not do 5b work.** Nothing in this run needs the public name or domain: no domain purchase, no production Clerk instance, no WAF rules or rate limit, no full marketing site, no use of the name or tagline. Do not start Phase 6 or 7.

## Tasks

1. **Account deletion API (`DELETE /v1/me`).** Contract first, then the endpoint (`api-endpoint`, `db-migration` if a delete function is needed). Every protection from ADR 0012: Clerk session token only (PAT gets 403); Clerk reverification within 10 minutes; a confirmation word sent in the body; at most 3 attempts per user per day; rows deleted in one transaction, then storage, then the Clerk user, retrying until all are gone; log line with user ID and time only. Tests: user A can never delete user B, PAT gets 403, a stale session is refused, and a delete leaves no rows or storage objects for that user. This PR touches `packages/core/src/api/auth.ts` if auth changes, so it will be red.
2. **Account deletion screen.** In Settings: "Export your data first" (links to the F12 export), then a confirmation step where the user types the word, then a clear result and sign-out. Handles the reverification prompt, rate-limit, loading, error and offline states. Use `pwa-screen`; demo video; stacked on task 1 until it merges.
3. **Privacy policy draft.** Write it from the real data flows: Clerk, Supabase (eu-west-2), Groq, the embeddings provider, Grafana, Cloudflare; what is stored, how long, deletion and export, and who to contact (a placeholder for 5b). Plain English. Put it where the marketing site will read it later (no site work now). Label `owner-review`, mark it "DRAFT, owner review" at the top, and add it to "Docs to review". No demo video.
4. **Grafana alerts and dashboard in Terraform.** Alerts by email only: API 5xx rate, p95 latency, AI usage spike (cost guard), nudge job failure, Edge Function errors; and one dashboard showing all of them, in the `grafana-stack` module (`infra-change`). The contact email comes from a variable fed by a secret, never written in the repo. Apply runs in GitHub Actions only.
5. **Production review items.** One PR or issue per item:
   1. Run the deeper `vulnerability-scanner` review (ADR 0010); fix findings or record why accepted.
   2. Write the k6 load test for dev at about 10 times beta traffic on non-AI routes and a light sample on AI routes; add a 1-minute production smoke test. Do not run anything against production from a session.
   3. Run the DeepEval set against production's model.
   4. Write the Supabase restore drill steps in `docs/` for the owner to run.
   5. Open a red sign-off PR with a checklist of items 1 to 4 for the owner.
6. **Pinned issue habit.** Create the issue "Docs to review" if it does not exist, label `owner-review`, and pin it. Every document the owner must read is listed as a checklist item. Write the rule in `CLAUDE.md` working style in the same PR (red, because of `docs/`). Pinning needs GraphQL; if it fails, add a `needs-owner` line asking the owner to pin it.

## Finish

Comment on the progress issue with: the PRs in merge order, which merged automatically and which wait for the owner, open `needs-owner` issues, and anything you would do differently. List the manual steps the owner still has to do in one checklist (Clerk reverification, alert email, restore drill, sign-off). Then add the `run-finished` label. Phase 5b, 6 and 7 each need their own grill and brief.
