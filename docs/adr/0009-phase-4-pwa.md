# ADR 0009: Phase 4, the PWA

- Status: Accepted; amended by ADR 0010 (QA and security specialist agents)
- Date: 2026-11-22
- Decider: Vikram Nayyar
- Method: `/grill-me` session at the desk (three rounds)
- Amends: ADR 0005 (yellow PRs now merge automatically)

## Context

Phase 3 is finished: every endpoint the PWA needs is merged and live in dev. Phase 4 builds the screens listed in `docs/requirements.md` ("Implementation order", step 4) on that API. Owner review became the bottleneck in run 3, and most Phase 4 PRs change only `apps/web`. There is no designer and no public name yet.

## Decision

### Stack in `apps/web`

| Concern | Choice |
| --- | --- |
| Build | Vite, React, TypeScript, Node 24 |
| Components | React Aria Components (accessible behaviour, no styling) |
| Styling | Tailwind CSS v4 driven by one design-tokens file; screens use tokens only, never raw colours or sizes |
| Routing | TanStack Router with typed routes and params |
| Data | TanStack Query for loading, caching, retries and refetch after edits |
| API client | `openapi-fetch` typed from `packages/api-contract`; no hand-written request types |
| Offline | `vite-plugin-pwa` (Workbox) service worker; IndexedDB queue for session logging |
| Sign-in | Clerk's prebuilt `<SignIn />` (email magic link, Google, Apple) |
| Barcode | `barcode-detector` polyfill (native `BarcodeDetector` where present, ZXing WebAssembly otherwise); manual ISBN entry and title search as fallback |
| Telemetry | Grafana Faro |

Rejected: shadcn/ui (copied files to own), MUI (heavy, Material look), Storybook (CI time and upkeep; `ui-diff` screenshots and Playwright cover review).

### Routes

`/sign-in`, `/` (shelf), `/books/new` (scan, search or past book), `/books/:id`, `/books/:id/log`, `/books/:id/finish`, `/search`, `/settings`. Clerk Paths: sign-in URL `/sign-in`, after sign-in `/` (set by hand; recorded in `infra/clerk-checklist.md`).

### Visual design

One blue-and-white direction, chosen by the owner: white surfaces, a deep ink blue for text and chrome, one brighter blue accent, blue-grey neutrals; dark mode uses the same blues on navy. System sans-serif for the interface and one serif for book titles and quotes. The accent lives in one token so a brand colour can replace it when the public name is chosen. The owner may revisit the direction later; because screens use tokens only, a redesign is a tokens change plus touch-ups.

Anti-generic rules (enforced by the `pwa-screen` skill): no gradient hero banners, glass cards or emoji as icons; no stock Tailwind palette; book covers and the user's own words are the visual centre; real seeded content in every screenshot.

### Offline and data on the device

- Logging a session (typed note and audio) works offline: it goes to an IndexedDB queue and uploads when back online.
- Every other screen shows the last data it loaded, read-only, under an "offline" banner.
- Notes cached on the device are wiped on sign-out (offline queue, Query cache, service worker caches). Settings has a "Clear data on this device" button.

### Voice notes

MediaRecorder records `audio/mp4` (uploaded as `m4a`) on iOS Safari and `webm` on Chromium; both are already accepted by `AudioUploadCreate`. At most 10 minutes per note, with a visible timer. Microphone permission is asked only on tapping Record; a refusal falls back to a typed note.

### Security

The API and RLS stay the security boundary. In addition:

- Every route except `/sign-in` requires a Clerk session; the token stays inside Clerk's SDK, never in our storage.
- `apps/web/public/_headers` sets a strict Content-Security-Policy (scripts from the app and Clerk only; connections to the API, Clerk and Faro only), `frame-ancestors 'none'`, HSTS, `Referrer-Policy: no-referrer` and a `Permissions-Policy` allowing camera and microphone for the app only. A CI test checks the headers on the deployed preview.
- No third-party scripts besides Clerk and Faro; dependencies pinned exactly.
- Faro sends errors, timings and the route pattern (for example `/books/:id`) only. No console capture, session replay or request bodies. A test fails if any captured field contains seeded note text.
- Before run 4 finishes, the `vulnerability-scanner` skill runs over `apps/web` and its findings are fixed.

### Hosting and infrastructure

A new Terraform `cloudflare_pages_project` for the web app, served at its `*.pages.dev` address until the public name and domain exist, and a Grafana Faro app in Terraform. `DEV_CLERK_PUBLISHABLE_KEY` (already set) reaches the build as a variable.

### Testing

- UI behaviour: Playwright against the local stack and the real API, with axe in every test. No component tests that fake our own API (CLAUDE.md "No test doubles").
- Pure frontend logic (offline queue, formatting, validation): Vitest.
- The E2E job runs only when `apps/web/**`, `packages/core/**`, `packages/api-contract/**` or `supabase/**` change; Chromium on every PR, WebKit nightly on `main`.

### Videos

Each feature PR adds one `demo` Playwright test on seeded data. CI records it, adds a Piper voice-over from `docs/videos/<feature>.txt` written in ASD-STE100, and links the artifact from the PR. Piper checksums (#28) are pinned in run 4. The endpoint videos deferred from #93 are covered by these screen demos in run 5.

### Merging (amends ADR 0005)

Yellow PRs now merge automatically, like green ones, when every check on the latest commit passes, the PR targets `main`, it was opened from this repository by the owner's account, and its body has a `## Risk note` section. Red stays owner-only. Red now also covers `docs/adr/`, `docs/briefs/`, `docs/requirements.md`, `packages/core/src/api/auth.ts` and `apps/web/public/_headers`, so decisions, auth and the security headers always reach the owner. Issue #188 added the auth wiring (`packages/core/src/api/app.ts`, `supabase/functions/api/index.ts`, `supabase/config.toml`, the Edge Function `deno.json` and import map) and the dependency and lint files (every `package.json`, `package-lock.json`, `.npmrc`, `.oxlintrc.json`), so a small PR cannot weaken an auth check or add an install script without owner review.

### Runs

| Run | Contents |
| --- | --- |
| 4 (Musts) | Scaffold `apps/web`; Terraform (Pages, Faro); CI (E2E, videos, Piper pinning); skills (`pwa-screen`, `ui-diff`); design tokens; app shell and sign-in (F1); shelf (F3); add book with barcode (F2); past books (F13); log session with voice, offline queue, transcript and insights (F4 to F6); finish flow with reflections (F8); search (F10) |
| 5 (Shoulds) | Quote photo (F7), book summary (F9), ask the vault (F11), export (F12), activity calendar (F14), nudge settings and push (F15), stats screen (#101), endpoint videos (#93), and a QA agent |

The QA agent is a daily Sonnet routine that drives the dev PWA with seeded test users, runs axe and edge cases, and files `bug` issues with steps and a screenshot. The owner's Dispatch reports file the same kind of issue. The build routine fixes `bug` issues before new tasks, each fix starting with a failing Playwright test.

Post-MVP, unchanged: the AI copilot ("AI chat" in `docs/requirements.md`).

## Consequences

- The owner reviews only red PRs, so run 4 moves at CI speed. Accepted risk: a wrong yellow PR reaches `main`; the fix is a new PR, and the owner can read any merged PR afterwards.
- Tokens-only styling makes a later redesign cheap but means every new visual need adds a token first.
- Notes cached on the device are readable by anyone holding the unlocked phone until sign-out. Accepted for offline lookup; revisit if shared devices become a use case.
- `ui-diff` (reviewed 2026-11-21) refused public repos at that version, and the repository is now public. If it still does at the pinned commit, PR screenshots come from Playwright instead.
- Revisit when: the public name is chosen (accent token, domain, Pages custom domain); WebKit-only bugs slip past the nightly run (move WebKit to every PR); yellow auto-merges cause rework (tighten what counts as yellow).
