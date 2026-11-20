# Book Vault — MVP Requirements

Nov 13, 2026 · Vikram Nayyar · Source of truth for this repo (exported from the requirements doc on 20 Nov 2026)

## Vision and positioning

Book Vault is a private, AI-powered memory for the physical books you read: you talk while you read, and it turns that into insights you can find and revisit for years.

Tracking alone is solved. [StoryGraph](https://bestwriting.com/goodreads-alternatives) leads on stats, and [Pick Up](https://www.pickupreader.com/blog/reading-tracker-comparison) already logs sessions with transcribed voice notes. Neither turns notes into insights or brings them back later.

**The wedge:** capture is effortless (one voice note per session), and the value is what comes out: extracted insights, search across every book, and old thinking resurfaced.

**Not building:** a social network, recommendations, or a Goodreads clone.

Core loop: 1. Capture (voice note per session, page photo quote, finish review) → 2. AI processes (transcribe, extract insights and quotes, user edits or pins) → 3. Your vault (books, sessions, insights, quotes, reviews, photos; private by default) → 4. Get it back (shelf by year, search all notes, ask the vault; later: resurfacing). Capture stays one tap; the product's value sits in steps 2 to 4.

## Users and use cases

The first user is a reader of physical books who finishes a book and forgets it. Notes on paper or in a phone get lost, and nothing records what was read.

1. **Start a book:** scan the barcode, and the book is on my shelf with its cover.
2. **Log a session:** after reading, tap once, say the pages and what struck me, done in under 30 seconds.
3. **Capture a quote:** photograph a page, highlight the passage, save it.
4. **Finish a book:** rating, photo of me with the book, answers to a few AI questions.
5. **Look back:** browse what I read by year, open a book, see its top insights.
6. **Find an idea:** search "habits" or ask "what have I read about leadership?" across all books.

## MVP functional requirements

The MVP has 15 requirements; the 9 marked Must ship before anyone else sees it.

| ID | Area | Requirement | Priority |
| --- | --- | --- | --- |
| F1 | Accounts | Sign up and log in with email magic link or Google; every record belongs to one user | Must |
| F2 | Add book | Scan ISBN barcode with the camera; fetch title, author, cover, page count from Open Library or Google Books; manual search and entry as fallback | Must |
| F3 | Shelf | Statuses: Reading, Finished, Abandoned; bookshelf view by year with covers | Must |
| F4 | Session log | One-tap "Log session": page range or chapter (user's choice), voice note or typed note | Must |
| F5 | Transcription | Voice note transcribed automatically; transcript editable | Must |
| F6 | AI insights | Per session, AI extracts 1 to 5 key insights and any quotes; user can edit, delete or pin them | Must |
| F7 | Quote photo | Photograph a page, OCR the text, select the passage, save as a quote with page number | Should |
| F8 | Finish flow | Mark finished; 1 to 5 star rating; finish photo; free-text review; 3 AI-generated reflection questions based on the user's own notes; the same questions are offered mid-book from the notes so far | Must |
| F9 | Book summary | On finish, AI writes a short summary of the user's thinking on the book (from their notes, not the book itself) | Should |
| F10 | Search | Keyword search across insights, quotes, transcripts and reviews | Must |
| F11 | Ask the vault | Natural-language question answered from the user's notes, citing book and session | Should |
| F12 | Export | Download all data as Markdown and JSON | Should |
| F13 | Past books | Add a book already finished before the app: skip sessions, set an approximate finish date (month and year, or year only), rating, optional photo, and one "what I remember" voice note that AI turns into insights; AI asks 3 recall prompts to jog memory | Must |
| F14 | Activity calendar | Calendar heatmap of days with at least one entry; no streak counter, no penalty for gaps | Should |
| F15 | Daily nudge | Opt-in web push at a time the user picks, sent only if no entry that day and a book is in Reading; one tap opens Log session; a "Not reading today" toggle silences it until tomorrow; needs the PWA installed to the home screen; sent by a scheduled Supabase job | Should |

AI works only on what the user said or captured. It never summarises the book's text, which avoids copyright problems and keeps the vault personal.

## Out of scope (later phases)

These wait until the vault holds 20 or more books of real notes.

- **MCP server (first after MVP):** lets users log and read their vault from AI assistants such as Claude, ChatGPT or Cursor without opening the app. Tools: add book, log session, list books, search the vault, designed around the reader's jobs rather than mirroring endpoints (for example, log session accepts a free-form reflection and the assistant fills in pages and insights). Includes MCP prompts such as "reflect on today's reading". Ask the vault is not exposed over MCP. Opt-in per user, OAuth login (check Clerk support), separate read and write scopes, rate limits, tool output treated as data. A separate project with its own hosting (possibly AWS), monitoring, security review and DeepEval testing; it calls the Book Vault API like any other client.
- **AI chat:** a vault-wide chat and a conversational end-of-book reflection, answering from the user's own notes with sources, with "save as insight" (paid tier)
- **Resurfacing:** weekly "you wrote this 6 months ago" digest
- **Analytics dashboard:** books per month, pages per session, ratings
- **Book graph:** links between books by shared themes in the user's insights
- **Shareable finish card and Year in Review:** cover, finish photo, rating and top insight as an image for social posts
- **Imports:** Goodreads or StoryGraph CSV
- **Kindle and audiobooks**
- **Revenue ideas:** Bookshop.org UK affiliate links on want-to-read and "gift this book" (10% commission), clearly disclosed; printed annual reading journal; gift subscriptions; lifetime deal, only once AI cost per user is known
- **Not planned:** ads, selling or sharing reading data, paywalled export, social network, recommendations

## Tiers and cost model

Gate the free tier on AI usage, not just audio storage: transcription and AI calls are the costs that grow with every user, free or paid.

| | Free | Vault+ (paid) |
| --- | --- | --- |
| Price | £0 | £20/year (shown first) or £2.99/month |
| Books, sessions, typed notes, search, export, calendar | Unlimited | Unlimited |
| Voice transcription | First 3 books, up to 60 minutes a month | Up to 10 hours a month (fair use) |
| Longest single voice note | 3 minutes | 10 minutes |
| AI insights per session | Yes | Yes |
| Reflection questions (mid-book and end) | Yes | Yes |
| Ask the vault | 5 questions a month | 200 questions a month |
| Book summary | No | Yes |
| Audio kept after transcription | No | Yes |
| Finish photo | Yes | Yes |

**Pricing rules**

- Yearly first: one card payment a year instead of twelve, so the fixed per-payment card fee is paid once; monthly is priced so yearly saves about 44%.
- Founding members: the first 100 paying users get £15/year, locked in while they stay subscribed.
- Limits reset on the 1st of each month. A warning shows at 80% of any limit; when a limit is hit, typed notes still work and nothing already saved is lost.
- Limits are enforced server-side, from the per-user usage metrics.
- Estimated AI and transcription cost for a heavy paid user is well under £1 a month (approximate; confirm against real usage). Review prices after 3 months of real data.
- Build tiers into the data model from day one, but ship single-user with no payments first.
- No ads: showing Google ads behind a login means giving Google's crawler access to private pages. A donation link (Ko-fi or a Stripe payment link) sits in settings instead.

## Platform, privacy and data

A mobile-first PWA, installed to the iPhone home screen, private by default.

**Platform**

- Camera barcode scan: Safari on iOS has no built-in barcode detector, so use a JS library (for example ZXing)
- Voice recording via the browser's MediaRecorder; upload after recording, retry if offline
- A session can be logged offline and synced later

**Privacy**

- Everything private; no public profiles
- AI providers called with no-training settings; data never used to train models
- Delete account removes all data, audio included

**Data model (first pass)**

| Entity | Key fields |
| --- | --- |
| User | id (Clerk user id), email, tier, founding member, nudge time, created |
| Book | id, user, ISBN, title, author, cover, pages, status, started, finished, added retrospectively |
| Session | id, book, date, page from, page to, chapter, audio ref, audio seconds, transcript |
| Insight | id, session or book, text, kind (insight or quote), page, pinned, embedding |
| Reflection | id, book, stage (mid-book or end), questions, answers |
| Review | book, rating, text, photo ref, summary |
| Usage | user, month, voice minutes, vault questions, AI tokens |

## Tech stack

Start on Supabase with plain Postgres and S3-style storage, so a later move to AWS is a dump-and-restore, not a rewrite.

Architecture: the PWA (React + Vite, Cloudflare Pages) signs in with Clerk and sends every call, with its Clerk token, through Cloudflare WAF at the api subdomain to the Book Vault API (Hono on Supabase Edge Functions, OpenAPI contract). The API reads and writes Postgres (pgvector, RLS) and Storage (private, signed URLs); a scheduled job triggers the daily nudge. Only the API calls paid services (speech-to-text, Claude, embeddings, Web Push); API keys stay server-side. Telemetry from the PWA and functions goes to Grafana Cloud.

Every client (the PWA now, the MCP server later) goes through the Book Vault API; row-level security stays on as a second line of defence. Audio and photos upload straight to storage with short-lived signed URLs issued by the API. GitHub Actions deploys every part.

| Layer | Start with | AWS later |
| --- | --- | --- |
| Frontend | React + Vite + TypeScript PWA on Cloudflare Pages | S3 + CloudFront |
| Database | Supabase Postgres + pgvector, schema in SQL migration files | RDS or Aurora Postgres via pg_dump and restore |
| Files | Supabase Storage, private buckets, signed URLs | S3 |
| Server logic | Book Vault API: Hono on Supabase Edge Functions with an OpenAPI contract; the only way clients read or write data; also transcription, insights, ask the vault, daily nudge, usage limits | Lambda behind API Gateway |
| Auth | Clerk (magic link, Google), connected to Supabase as third-party auth; Clerk Billing for the paid tier later | Clerk stays; no user migration needed |
| AI | Direct provider API, cheapest model that passes quality checks, behind one AI module. Migrate to Bedrock only if the app moves to AWS (same per-token price); Groq (hosted Whisper) for speech-to-text; separate embeddings provider | Same, or Bedrock |
| IaC | Terraform for Supabase project, hosting and DNS; SQL migrations in Git | Terraform AWS modules |
| CI/CD | GitHub Actions: lint, test, apply migrations, deploy functions and frontend; preview per PR | Same pipelines, new targets |

**Portability rules**

- AI and business logic live in a plain TypeScript package; Edge Functions are thin wrappers, so moving to Lambda is a wrapper swap
- Only standard Postgres features in the schema; no data logic hidden in the dashboard
- Node 24 for tooling, CI and builds; Edge Functions run on Deno, so the core package uses web-standard APIs only and runs on both
- Auth reached through one small module, so swapping providers touches one place

**Security**

- Row-level security on every table: users only ever see their own rows
- AI and speech API keys live only in server-side secrets, never in the browser
- Per-user rate limits and the tier cap enforced in functions, to control cost
- Audio and photos in private buckets, served through short-lived signed URLs
- Dependabot and secret scanning on the repo

**Cloudflare WAF and the API gateway**

Cloudflare only protects traffic that passes through it, and Supabase Edge Functions live on a Supabase address. So the API is served at an api subdomain through a small Cloudflare Worker that forwards to Supabase.

- The Worker adds a secret header; the API rejects any request without it, so the raw Supabase address cannot be used to bypass the WAF
- Free plan limits: 5 custom WAF rules, the Cloudflare Free Managed Ruleset, and 1 rate limiting rule with a 10-second window
- Custom rules: block known-bad paths and methods, allow only expected countries if abuse appears, challenge traffic with a high bot score on the marketing site
- The single rate limiting rule protects the API by IP; per-user limits (tier caps, AI calls) are enforced inside the API
- All WAF rules, the Worker and its routes are managed in Terraform

**Load testing (k6)**

- k6 scripts in the repo, run from GitHub Actions on demand and before each release, not on every PR; local runs by default
- Scenarios: a realistic mix of reads and session logging, a spike (for example 10x normal traffic in one minute), and a 1-hour soak
- Runs against dev with a fake AI and speech provider switched on, so tests never pay Groq or Claude or hit their limits
- A dev-only WAF rule lets the load-test traffic through; a separate short test confirms the rate limiter does block
- Thresholds fail the run: p95 latency and error rate on each endpoint, agreed once there is a baseline
- Results land in Grafana next to normal telemetry

**Ask the vault flow:** when an insight is saved, a function stores its embedding. A question is embedded, the closest insights are found with pgvector, and Claude answers from only those, citing book and session.

**Later, only if needed:** containers, Kubernetes, microservices.

**Marketing site vs the app**

The public site and the app are separate projects, deployed separately, so a marketing change can never break the app.

| | Marketing site | Web app (PWA) |
| --- | --- | --- |
| Address | apex domain and www | app subdomain |
| Purpose | What it is, pricing, FAQ, privacy policy, terms, changelog, donation link, waitlist (a link to the Book Vault section of Vikram's Substack) | Everything a signed-in user does |
| Stack | Static site (for example Astro) on its own Cloudflare Pages project | React + Vite PWA on Cloudflare Pages |
| Sign-in | None | Clerk |
| Payments | Shows plans; "Get started" links into the app | Checkout and plan changes through Clerk Billing |
| Analytics | Cookieless Cloudflare Web Analytics, so no cookie banner | Grafana Faro, no note content |

- Plan names, prices and limits live in one shared config file, read by the marketing site at build time and enforced by the API
- Monorepo: apps/site, apps/web, packages/core, packages/api-contract; each app has its own pipeline triggered only by its own changes
- The MCP server lives in its own repo

## Engineering practices

Three environments, one pipeline, real dependencies in tests, and accessibility and observability from the first commit.

**Environments**

| | Local | Dev | Production |
| --- | --- | --- | --- |
| Database and storage | Supabase CLI stack in Docker, seeded test data | Own Supabase project | Own Supabase project |
| Auth | Clerk development instance | Clerk development instance | Clerk production instance |
| Frontend | Vite dev server | Cloudflare Pages preview per PR | Cloudflare Pages production |
| AI and speech | Real APIs, cheapest model, low caps | Real APIs, low caps | Real APIs, tier caps |
| Deploys | On your machine | Automatic on merge to main | GitHub Actions with manual approval |

Secrets live per environment in GitHub Environments and Supabase; nothing is shared between dev and production.

**CI/CD (GitHub Actions)**

1. Every PR: lint, typecheck, unit tests, migrations applied to a fresh local Supabase, Playwright E2E with accessibility checks, Terraform plan, preview deploy.
2. Merge to main: migrations, Edge Functions and Terraform applied to dev.
3. Release: k6 load tests run on dev, then manual approval promotes the same build and migrations to production.

**Testing**

- API tests run against the real local stack (Postgres, storage, functions), checked against the OpenAPI contract
- Playwright E2E for the PWA, against the same local stack
- No test doubles: paid third parties (speech-to-text, Claude, embeddings) are intercepted at the network level with MSW replaying recorded responses, enforced by the Landmines lint rules
- Vitest for pure logic: insight parsing, tier caps, date handling
- DeepEval evals on AI insights, reflection questions and ask the vault answers, run against a fixed set of sample notes; backs the "80% of insights kept" success measure
- Row-level security tests: user A can never read user B's books, notes or files

**Accessibility (WCAG 2.2 AA)**

- Automated axe checks inside every Playwright test, failing the build on violations
- Manual keyboard and VoiceOver pass before each release
- Every voice action has a typed alternative; the activity calendar does not rely on colour alone; reduced-motion respected

**Observability**

- Grafana Cloud free tier for logs, metrics and traces from the PWA and Edge Functions, sent over OpenTelemetry; Grafana Faro for frontend errors and performance
- Structured JSON logs with a request ID that follows a call from PWA to function to AI provider
- OpenTelemetry-style traces keep the instrumentation portable to AWS CloudWatch and X-Ray if the app moves
- AI usage metrics per user per day (tokens, audio minutes), which also drive the tier caps and cost alerts
- Uptime check on the app and functions
- Never log note text, transcripts, audio or photos

## AI-native development

Claude Code is the main development tool, guided by CLAUDE.md, project skills, read-only MCP servers and hooks that enforce the rules above.

**Project skills (.claude/skills), each written with skill-creator once a task has been done twice the same way**

| Skill | What it walks Claude through |
| --- | --- |
| infra-change | Add or change a Terraform module, run fmt, validate and plan, never touch a dashboard, confirm the drift check stays clean |
| db-migration | New migration only (never edit an applied one), RLS policy, RLS test, seed data update |
| api-endpoint | Update the OpenAPI contract, implement in the core package, thin Hono handler, API and RLS tests, usage-limit check |
| ai-prompt-change | Prompts live in versioned files; run the DeepEval set before and after, compare scores and estimated cost per call |
| pwa-screen | Component, axe checks, Playwright E2E, offline behaviour, no note content in telemetry |
| security-review | Secrets scan, auth on every route, RLS coverage, WAF rule impact, OWASP API Top 10 checklist |
| release | Migrations reviewed, evals and k6 passing on dev, changelog, then approval |
| adr | Write an architecture decision record for any choice that would be costly to reverse |

**Community skills and tools**

| Name | Source | Use in this project |
| --- | --- | --- |
| grill-me | mattpocock/skills (skills.sh) | Before any phase or feature: Claude interviews Vikram until every open decision is resolved; answers go into an ADR or the requirements |
| ponytail | DietrichGebert/ponytail | Keeps Claude to the least code that works; a review pass on PRs, not always on, so it never trims tests, RLS, accessibility or IaC |
| Landmines | @interfere/landmines (npm, Oxlint plugins by Luke Shiels) | Lint rules that block AI shortcuts in CI: no test doubles, strict MSW, no fixed sleeps or retries, no prose comments. Needs Oxlint 1.81+. Gotchas are logged separately in docs/GOTCHAS.md |

- Read every third-party SKILL.md and any hooks it ships before committing it
- CLAUDE.md non-negotiables win over any community skill's advice

**MCP servers for development (read-only by default)**

- GitHub: PRs, issues, Actions runs
- Supabase: schema, logs and SQL on the local and dev projects only, never production
- Cloudflare: Workers, Pages, DNS and WAF state
- Terraform (HashiCorp): provider and module documentation
- Grafana: logs, traces and dashboards while debugging
- Playwright: driving the PWA in a real browser
- Context7: current library docs, so Claude does not invent APIs

**MCP configuration:** project-scoped, in a committed .mcp.json at the repo root. It holds no secrets: tokens are referenced as ${VAR} and set as Windows user environment variables. Remote servers sign in with OAuth where offered. On native Windows, npx-based servers are wrapped as cmd /c npx. Tokens are dev-only and least-privilege; nothing points at production.

**Where Claude Code runs:** native Windows at the desk; Claude Code cloud sessions from the phone. GitHub is the source of truth.

- CLI first, MCP second: every task works through scripts and CLIs (gh, supabase, terraform, wrangler, npm)
- The cloud environment defines the same variable names as Windows, holding dev-only tokens; its setup script installs Node, Terraform and the Supabase CLI
- Its network access allows only the domains the project needs
- Terraform applies and deploys only ever run in GitHub Actions
- Phone sessions suit small, well-scoped tasks; bigger work happens at the desk

**Hooks and subagents**

- Hooks: lint and typecheck after edits; block edits to applied migrations and to .env files; block commits containing secrets
- Subagents: a code reviewer and a security reviewer that check work they did not write, before a PR is opened

## Infrastructure as Code

Every environment is created from code, Cloudflare included; nothing is set up by clicking in a dashboard unless no provider exists.

| Service | Managed by | What's in code |
| --- | --- | --- |
| Cloudflare | Terraform (Cloudflare provider) | Two Pages projects (marketing site and app) with custom domains, API gateway Worker and route, WAF custom and rate limiting rules, DNS records, security and cache rules, R2 bucket for Terraform state |
| Supabase | Terraform (Supabase provider) plus Supabase CLI | Dev and production projects and settings; schema, RLS, storage buckets, Edge Functions and scheduled jobs as migrations and config in Git |
| GitHub | Terraform (GitHub provider) | Repo settings, branch protection, Environments, required checks |
| Grafana Cloud | Terraform (Grafana provider) | Stack, Faro app, dashboards, alert rules |
| Clerk | Checklist in the repo plus a CI script against Clerk's API | No official Terraform provider found; the script checks settings match the checklist |
| Groq, Claude, embeddings | API keys created by hand | Stored only as GitHub Environment and Supabase secrets |

**Rules**

- Terraform state lives in Cloudflare R2, created once by a small bootstrap stack
- One Terraform root per environment (dev, production) sharing the same modules
- Every PR runs terraform fmt, validate and plan; merges apply to dev; production applies after approval
- A nightly plan in CI flags drift, so any dashboard change made by hand is caught
- Done means dev can be destroyed and rebuilt from the repo with one pipeline run

## Implementation order

Backend infrastructure first, then the API, then the frontend; the MCP server is a separate project after launch.

1. **Foundations (IaC and CI/CD):** repo, Terraform bootstrap and state in R2, Cloudflare, Supabase, GitHub and Grafana modules, Clerk checklist, CLAUDE.md, hooks, MCP config and the infra-change and adr skills, pipeline that deploys to dev and production with no manual steps; a one-page marketing site with a waitlist goes live here.
2. **Backend data layer:** schema, RLS, migrations and seed data, storage buckets, Clerk as third-party auth, usage table; RLS tests in CI.
3. **API:** OpenAPI contract first, then endpoints: books (barcode lookup, past books), sessions with signed audio uploads, Groq transcription, AI insights, finish flow and reflections, search, export, usage limits; then ask the vault, book summary, quote photo OCR, nudge scheduling. API tests in CI; DeepEval evals on AI outputs. Vikram dogfoods through an iOS Shortcut that records a voice note and posts a session to the dev API.
4. **Frontend PWA:** screens built on the finished API: shelf, add book, log session, finish flow, search, activity calendar, ask the vault, nudge settings; Playwright E2E with axe checks.
5. **Launch readiness:** Clerk Billing tiers and founding members, full marketing site with pricing from the shared plan config, donation link, privacy policy, account deletion, Grafana dashboards and alerts, production review.
6. **MCP server (separate project):** its own repo, hosting (possibly AWS), OAuth, monitoring, security review and DeepEval testing; calls the Book Vault API like any other client.

## Success criteria and open questions

The MVP works if Vikram logs every reading session of his next two books without it feeling like a chore.

- Logging a session takes under 30 seconds
- 80% or more of AI-extracted insights kept without heavy editing
- After finishing, he opens a book's page again within a month to look something up

**Open questions**

- [ ] Public name: an App Store app called "BookVault: Track Your Library" already exists. Build under the placeholder Book Vault; the name, domain and handles live in one config file and one Terraform variable. Choose the public name before buying the domain or launching the waitlist.

**Decided**

- Speech-to-text: Groq (hosted Whisper), kept behind one interface so it can be swapped
- Pricing: free tier with voice on the first 3 books (60 minutes a month); Vault+ at £20/year or £2.99/month; founding members £15/year
- Logging: by page range or by chapter, whichever the user prefers
- AI reflection questions offered mid-book as well as at the end
- Observability: Grafana Cloud free tier
- Build order: infrastructure as code, data layer, API, PWA; MCP server as a separate project after launch
- All clients go through the Book Vault API, served behind Cloudflare WAF via a gateway Worker
- Marketing site and web app are separate projects in one monorepo, sharing one plan config
- Load testing with k6; AI evals with DeepEval; linting with Oxlint + Landmines; Node 24
- Waitlist: a "building Book Vault" section on Vikram's Substack, linked from the marketing site (no embedded form, so no cookies)

## Sources

- [Pick Up: reading tracker comparison](https://www.pickupreader.com/blog/reading-tracker-comparison)
- [Best Goodreads alternatives 2026](https://bestwriting.com/goodreads-alternatives)
