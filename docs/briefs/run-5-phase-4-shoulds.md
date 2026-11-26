# Run 5: Phase 4 PWA, the Shoulds

Brief for an unattended Claude Code cloud session. Red PRs wait for the owner; green and yellow PRs merge automatically when every check passes (ADR 0009). You never merge. ADR 0011 is the plan for this run.

## Before anything else

1. **Is it run 5's turn?** If the issue **Run 4 progress** does not have the `run-finished` label, end the session.
2. Read `CLAUDE.md`, `docs/requirements.md`, and every ADR in `docs/adr/` (0001 to 0011). They win over this brief if they disagree. ADR 0011 is the plan for this run.
3. Confirm you are in the `book-tracking-dev` environment, on this repository alone. If `gh pr merge 1` is not blocked by the `block-merges` hook, stop: the hooks are not running.
4. Find the open issue titled **Run 5 progress**. If none exists, create it with the task list below as checkboxes. Tick each task when its PR is open, with the PR link.

## Running on a schedule

A scheduled task starts a new session every hour. It ends at once when there is no work. Each session checks the **Run 5 progress** issue before doing anything else, so two sessions never work at once:

1. **Finished?** If it has the `run-finished` label, comment nothing and end the session.
2. **Someone else working?** If it has the `run-active` label and its newest comment starting `Heartbeat` is less than 50 minutes old, fix any PR labelled `conflicts` (see below), then end the session.
3. **Claim it.** Otherwise add `run-active` and comment `Heartbeat: started, next task N`.
4. **Keep it alive.** Comment `Heartbeat: task N, <what you are doing>` at least every 20 minutes and after each PR.
5. **Hand over.** Before ending for any reason, tick finished tasks, comment `Heartbeat: stopped, next task N, <why>`, and remove `run-active`. Add `run-finished` and post the Finish comment only when every task is done or blocked **and** no owner request is open on any run 5 PR or the progress issue.

**Cap on open PRs.** Do not start a new task while 5 of this run's PRs are open and unmerged. Fix bugs, conflicts and review comments instead, then end the session.

**Order of work every session (ADR 0010):** (1) PRs labelled `conflicts` or showing as conflicting, (2) owner review comments on open PRs, (3) open PRs with failing CI, (4) `security` issues of high or critical severity, (5) `bug` issues, (6) `dependabot` issues, (7) other `security` issues, (8) the next task. Each fix starts with a failing test that proves the problem.

**Keep working.** After each PR, start the next unblocked task straight away, unless the cap applies. End only when every remaining task is blocked or done, about 50 minutes have passed, or you are about to run out of context. Never end because a PR was opened or CI is running.

## Orchestrate with subagents

The session is an orchestrator and keeps its own context small: schedule rules, heartbeats, the progress issue, owner comments, choosing the next task. Each task goes to one `general-purpose` subagent, given the task's text from this brief (copied, not summarised), the branch to start from, this brief's "How to work" section and the skills to use. It opens the PR, waits for CI with one blocking command, fixes failures, and replies in one line: `PR #N, <green | failing: reason | blocked: reason>`. Mechanical jobs (reading a failed CI log, Context7 lookups) go to a `haiku` subagent. At most 2 workers at once, only on tasks that do not depend on each other, each with `isolation: "worktree"`.

## Keep output short

Follow the `terse` skill. Every yellow or red PR body has a `## Risk note` section from the `risk-note` skill; without it a yellow PR does not merge. Normal, clear sentences where the owner reads and decides: PR titles and bodies, `needs-owner` issues, review replies, the Finish comment, commit subjects.

## How to work

- GitHub GraphQL is blocked in cloud sessions: use REST through `gh api repos/vikramnayyarcs/book-tracking-system/...` for issues, PRs and labels.
- One task per PR, small commits, one concern each. Branch from `main`; when a task needs an unmerged PR, stack on that PR's branch and say "Stacked on #N" in the body. Stacked yellow PRs merge only once they target `main`.
- Before opening a PR, run lint, typecheck and the affected tests in the session and say so in the PR body. Every PR also passes the CI jobs, including the Terraform job and `plan-dev`. Never retry, skip or raise timeouts to get green.
- Never merge, push to `main`, trigger workflows or apply Terraform.
- **Screens and components use the `pwa-screen` skill.** `infra/` changes use the `infra-change` skill. API changes use `api-endpoint`; schema changes use `db-migration`. The contract changes first.
- **AI features** (ask the vault, book summary, OCR cleanup): prompts live in versioned files; run the DeepEval set before and after any prompt change. Groq, Claude and embeddings are intercepted with MSW replaying recorded responses.
- **Keep PRs free of conflicts** (CLAUDE.md). Merge the base in, keep both sides, regenerate generated files, check for duplicated keys and imports, run lint and typecheck, push, remove the `conflicts` label.
- **Tests:** UI behaviour with Playwright and axe against the local stack and the real API; pure logic with Vitest. Seeded test users and invented notes only; never record or log real notes, transcripts, audio or photos.
- **Videos:** every feature PR adds a `demo` Playwright test and a `docs/videos/<feature>.txt` script in ASD-STE100; CI records and voices it. Bug, infra, tooling and skill PRs say "No demo video" and why.
- If Playwright's browsers cannot be downloaded in the cloud session, rely on the CI E2E job and say so in the PR.
- Log surprising-behaviour detours in `docs/GOTCHAS.md` in the PR where they happened.
- Use Context7 for library docs and the Terraform MCP server for provider docs instead of guessing APIs.

## When to stop and ask

Open an issue labelled `needs-owner` with the question and your recommended answer, link it from the progress issue, skip the blocked task and anything depending on it, and carry on. Stop for: a decision the ADRs don't cover; a missing secret, account, token scope or network domain; a plan that would destroy or replace an existing resource; any dashboard change (Clerk is the owner's); an API operation the screens need that the contract lacks and that ADR 0011 does not list.

Do not start run 6 work (account deletion, privacy policy, Grafana alerts, production review) or anything from Phase 5b. Run 6 has its own brief.

## Tasks

0. **Fix open bugs, #159 first, then #158, if still open.**
   - #159: add `set -o pipefail` to the Plan steps in `deploy-dev.yml` and in `ci.yml` `plan-dev`; add `-lock-timeout=5m` to the plan and apply in `deploy-dev.yml` and to the plan in `drift.yml`. Start with a check that proves a failed plan fails the Plan step. Log the trap in `docs/GOTCHAS.md`. Use `infra-change`. No demo video.
   - #158: show the signed-in user's avatar in the app shell header, opening a menu with a clear **Sign out**; keep sign-out in Settings. Tokens only, React Aria, keyboard and screen reader, axe. Use `pwa-screen`.

### Screens (each uses `pwa-screen` and ships a demo video)

1. **Activity calendar (F14).** `/activity`: calendar heatmap of days with at least one entry; no streak counter, no penalty for gaps. Add the route to the navigation.
2. **Reading stats (#101).** On the same `/activity` screen, below the heatmap: books per month, pages per session, ratings. Charts follow the `dataviz` skill and the design tokens, with a text or table alternative for screen readers.
3. **Export (F12).** Contract first: `GET /v1/export` returns all of the user's data as JSON (`api-endpoint` skill, with cross-user test and usage-limit check). A function in `packages/core` turns the JSON into Markdown. The PWA downloads a zip with both files from a Settings button. Account deletion (run 6) later links to this button.
4. **Ask the vault (F11).** `/ask`: one question gives one answer with citations to book and session. History is not stored. Answers use only the user's own notes; an empty vault gets a plain "nothing to answer from" state. Prompt in a versioned file, DeepEval before and after.
5. **Book summary (F9).** Made automatically when a book is finished, shown on the book page, with a "Write again" button. It summarises the user's thinking, never the book's text. Prompt in a versioned file, DeepEval before and after.
6. **Quote photo (F7).** On the book page: take a photo with the phone camera picker (`<input capture>`), OCR, the user selects the passage and enters the page number, saved as a quote. The photo is deleted after OCR (ADR 0008). Offline shows a clear "needs a connection" state.
7. **Nudge settings and push (F15).** A Settings section: on/off, time picker, "Not reading today". It explains that iPhone push works only after the app is added to the home screen. The scheduled Supabase job sends only if there is no entry that day and a book is in Reading; one tap opens Log session. VAPID keys come from Terraform (`tls_private_key.vapid`); no owner step for keys. Use `db-migration`, `api-endpoint`, `infra-change` as needed.
8. **Endpoint videos (#93).** Issue #93 is closed; its recommendation still applies. Extend `pr-video` so the API tests write a request and response log, render it to a video with ffmpeg `drawtext`, and join it with the voice for `docs/videos/books.txt` and `docs/videos/sessions.txt`. Link the CI artifact from the PRs that added those endpoints. Use `infra-change` for workflow changes. No demo video of its own.

## Finish

Comment on the progress issue with: the PRs in merge order, which merged automatically and which wait for the owner (red), what each deploys, open `needs-owner` issues, anything Playwright could not test in WebKit, and anything you would do differently. List the manual steps the owner still has to do in one checklist. Then add the `run-finished` label. This starts run 6 (ADR 0012) and no other work.
