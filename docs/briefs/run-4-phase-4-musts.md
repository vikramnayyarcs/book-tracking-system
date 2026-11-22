# Run 4: Phase 4 PWA, the Musts

Brief for an unattended Claude Code cloud session. Red PRs wait for the owner; green and yellow PRs merge automatically when every check passes (ADR 0009). You never merge.

## Before anything else

1. **Is it run 4's turn?** If the issue **Run 3 progress** does not have the `run-finished` label, end the session.
2. Read `CLAUDE.md`, `docs/requirements.md`, and every ADR in `docs/adr/` (0001 to 0009). They win over this brief if they disagree. ADR 0009 is the plan for this run.
3. Confirm you are in the `book-tracking-dev` environment, on this repository alone. If `gh pr merge 1` is not blocked by the `block-merges` hook, stop: the hooks are not running.
4. Find the open issue titled **Run 4 progress**. If none exists, create it with the task list below as checkboxes. Tick each task when its PR is open, with the PR link.

## Running on a schedule

A scheduled task starts a new session every hour. Each session checks the **Run 4 progress** issue before doing anything else, so two sessions never work at once:

1. **Finished?** If it has the `run-finished` label, comment nothing and end the session.
2. **Someone else working?** If it has the `run-active` label and its newest comment starting `Heartbeat` is less than 50 minutes old, fix any PR labelled `conflicts` (see below), then end the session.
3. **Claim it.** Otherwise add `run-active` and comment `Heartbeat: started, next task N`.
4. **Keep it alive.** Comment `Heartbeat: task N, <what you are doing>` at least every 20 minutes and after each PR.
5. **Hand over.** Before ending for any reason, tick finished tasks, comment `Heartbeat: stopped, next task N, <why>`, and remove `run-active`. Add `run-finished` and post the Finish comment only when every task is done or blocked **and** no owner request is open on any run 4 PR or the progress issue.

**Order of work every session (ADR 0010):** (1) PRs labelled `conflicts` or showing as conflicting, (2) owner review comments on open PRs, (3) open PRs with failing CI, (4) `security` issues of high or critical severity, (5) `bug` issues, (6) `dependabot` issues, (7) other `security` issues, (8) the next task. Each fix starts with a failing test that proves the problem.

**Keep working.** After each PR, start the next unblocked task straight away. End only when every remaining task is blocked or done, about 50 minutes have passed, or you are about to run out of context. Never end because a PR was opened or CI is running.

## Orchestrate with subagents

The session is an orchestrator and keeps its own context small: schedule rules, heartbeats, the progress issue, owner comments, choosing the next task. Each task goes to one `general-purpose` subagent, given the task's text from this brief (copied, not summarised), the branch to start from, this brief's "How to work" section and the skills to use. It opens the PR, waits for CI with one blocking command, fixes failures, and replies in one line: `PR #N, <green | failing: reason | blocked: reason>`. Mechanical jobs (reading a failed CI log, Context7 lookups) go to a `haiku` subagent. At most 2 workers at once, only on tasks that do not depend on each other, each with `isolation: "worktree"`.

## Keep output short

Follow the `terse` skill. Every yellow or red PR body has a `## Risk note` section from the `risk-note` skill; without it a yellow PR does not merge. Normal, clear sentences where the owner reads and decides: PR titles and bodies, `needs-owner` issues, review replies, the Finish comment, commit subjects.

## How to work

- One task per PR, small commits, one concern each. Branch from `main`; when a task needs an unmerged PR, stack on that PR's branch and say "Stacked on #N" in the body. Stacked yellow PRs merge only once they target `main`.
- Every PR passes lint, typecheck, tests, the Terraform job, `plan-dev` and any job it adds. Never retry, skip or raise timeouts to get green.
- Never merge, push to `main`, trigger workflows or apply Terraform.
- **Screens and components use the `pwa-screen` skill.** `infra/` changes use the `infra-change` skill. If a screen needs an API operation that does not exist, stop and ask: Phase 3 is closed.
- **Keep PRs free of conflicts** (CLAUDE.md). Merge the base in, keep both sides, regenerate generated files, check for duplicated keys and imports, run lint and typecheck, push, remove the `conflicts` label.
- **Tests:** UI behaviour with Playwright and axe against the local stack and the real API; pure logic with Vitest. Groq is intercepted with MSW replaying recorded responses, as in Phase 3. Seeded test users and invented notes only; never record or log real notes, transcripts, audio or photos.
- **Videos:** every feature PR adds a `demo` Playwright test and a `docs/videos/<feature>.txt` script in ASD-STE100; CI records and voices it. Infra, tooling and skill PRs say "No demo video" and why.
- If Playwright's browsers cannot be downloaded in the cloud session, rely on the CI E2E job and say so in the PR.
- Log surprising-behaviour detours in `docs/GOTCHAS.md` in the PR where they happened.
- Use Context7 for library docs and the Terraform MCP server for provider docs instead of guessing APIs.

## When to stop and ask

Open an issue labelled `needs-owner` with the question and your recommended answer, link it from the progress issue, skip the blocked task and anything depending on it, and carry on. Stop for: a decision the ADRs don't cover; a missing secret, account, token scope or network domain; a plan that would destroy or replace an existing resource; any dashboard change (Clerk is the owner's); an API operation the screens need that the contract lacks.

Do not start run 5 work (quote photo, book summary, ask the vault, export, activity calendar, nudges, stats, QA agent) or launch-readiness work.

## Tasks

### Groundwork

1. **Scaffold `apps/web`.** Vite, React, TypeScript, Tailwind CSS v4, React Aria Components, TanStack Router, TanStack Query, and `openapi-fetch` typed from `packages/api-contract`, all pinned exactly. Workspace scripts `dev`, `build`, `preview`; included in root lint, typecheck and test. One placeholder route rendering the product name from `packages/core/src/brand.ts`. `vite-plugin-pwa` with a web app manifest (name from brand config) and a service worker that precaches the app shell only. `DEV_CLERK_PUBLISHABLE_KEY` and the API base URL come from build-time variables, never hard-coded.
2. **Terraform: web Pages project and Faro app.** A `cloudflare_pages_project` for `apps/web` in `infra/envs/dev` (reuse `modules/cloudflare-pages`), served at its `*.pages.dev` address, and a Grafana Faro app in the `grafana-stack` module whose collector URL reaches the web build as a variable. Wire the web deploy into `deploy-dev.yml`. If the Grafana token lacks the Frontend Observability scopes, stop and ask (the owner adds scopes by hand).
3. **CI for the PWA.** A Playwright E2E job with `@axe-core/playwright` against the local stack and `supabase functions serve`, path-filtered to `apps/web/**`, `packages/core/**`, `packages/api-contract/**`, `supabase/**`; Chromium on PRs, plus a nightly workflow on `main` that runs WebKit. A shared `expectNoAxeViolations(page)` helper. Extend `pr-video` to record `test/e2e/demo/*.demo.ts` and voice `docs/videos/*.txt` with Piper, pinning Piper's release and voice model by checksum (#28). A test that the deployed preview serves the `_headers` from task 6.
4. **UI skills.** Vendor `imuratalpay/ui-diff`'s `skills/ui-diff` into `.claude/skills/ui-diff` at a reviewed commit SHA (never `install.sh`); re-read its `SKILL.md`, hooks and `references/privacy.md` at that SHA first. It refused public repositories at v0.1.0 and this repository is now public: if it still does, do not vendor it; record that in the PR and in `pwa-screen` (screenshots come from Playwright). Keep its `ui-diff-assets` branch out of branch cleanup. Refine `.claude/skills/pwa-screen/SKILL.md` with the real file paths once tasks 1 and 3 exist.
5. **Design tokens.** One blue-and-white direction (ADR 0009) in `apps/web/src/styles/tokens.css` and the Tailwind theme: white surfaces; a deep ink blue for text and chrome; one brighter blue accent in a single token; blue-grey neutrals; dark mode with the same blues on navy; system sans-serif for the interface and one serif for book titles and quotes; spacing, radius and type scales. Every text and control pairing passes WCAG 2.2 AA contrast in both modes, proven by a Vitest test over the token pairs. A `/dev/tokens` route (dev builds only) showing every token, used for the PR screenshots in light and dark. The owner may comment on the look; act on those comments first.

### Screens (each uses `pwa-screen`; each stacks on the app shell until it merges)

6. **App shell and sign-in (F1).** Signed-in layout with navigation (Shelf, Search, Settings) and a Log session shortcut for the book in Reading; `/sign-in` with Clerk's `<SignIn />`; every other route redirects to `/sign-in` without a session. `apps/web/public/_headers` with the CSP, `frame-ancestors 'none'`, HSTS, `Referrer-Policy: no-referrer` and `Permissions-Policy` from ADR 0009 (this file makes the PR red). Faro set up with errors, Web Vitals and route patterns only, and a test that no captured field contains seeded note text. Sign-out clears the Query cache, the offline queue and service worker caches. Settings: sign out, "Clear data on this device", and the tier from `GET /v1/me`. Add the Clerk Paths (`/sign-in`, after sign-in `/`) to `infra/clerk-checklist.md` under "Not checked by CI".
7. **Shelf (F3).** `/`: books grouped by status (Reading first), then by year for Finished, covers as the visual centre; status changes (Reading, Finished, Abandoned) where the API allows.
8. **Add book (F2).** `/books/new`: scan an ISBN with the `barcode-detector` polyfill (camera permission asked on tap), look it up through the API, confirm and add; fallbacks: type an ISBN, or search by title and author, or enter by hand.
9. **Past books (F13).** From `/books/new`: add a book finished before the app with an approximate finish date (month and year, or year only), rating, optional photo, and one "what I remember" voice or typed note; show the AI insights and the 3 recall prompts.
10. **Log session (F4 to F6).** `/books/:id/log`: page range or chapter (the user's choice), voice note (MediaRecorder, `m4a` on iOS and `webm` on Chromium, 10-minute cap with a timer, permission on tap, typed fallback) or typed note; signed audio upload; offline queue in IndexedDB with retry and a visible "waiting to upload" state; then the transcript (editable) and insights (edit, delete, pin) when processing completes. Vitest covers the queue logic; Playwright covers the offline path with the browser set offline.
11. **Book page and finish flow (F8).** `/books/:id`: sessions, insights and quotes for the book, and the mid-book reflection questions. `/books/:id/finish`: rating 1 to 5, finish photo, review, and the 3 reflection questions.
12. **Search (F10).** `/search`: keyword search across insights, quotes, transcripts and reviews, results linking to their book and session, with highlighted matches.
13. **Security pass.** Run the `vulnerability-scanner` skill over `apps/web` and the headers; fix every finding in its own PR or record why it is accepted.

## Finish

Comment on the progress issue with: the PRs in merge order, which merged automatically and which wait for the owner (red), what each deploys, open `needs-owner` issues, anything Playwright could not test in WebKit, and anything you would do differently. Then list the manual steps the owner still has to do (Clerk Paths, any Grafana scopes) in one checklist, and remind the owner to set up the QA and security specialist routines (ADR 0010) from a desk session; link the issue that tracks it.
