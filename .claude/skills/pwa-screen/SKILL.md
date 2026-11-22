---
name: pwa-screen
description: Add or change a screen, route or shared component in apps/web. Use for any PWA UI work, so tokens-only styling, accessible React Aria components, every loading/empty/error/offline state, the Playwright + axe test, the demo video and the no-note-content telemetry rule are never skipped, and the result does not look like a generic AI-built site.
---

# PWA screen

Rules: `CLAUDE.md` non-negotiables and ADR 0009. The API is the only data source; never call Supabase or a paid provider from the browser.

## Steps

1. **Route.** Add or change the route with TanStack Router under `apps/web/src/routes/`, matching ADR 0009's route list. Every route except `/sign-in` sits under the signed-in layout. Typed params only; no manual `URLSearchParams` parsing.
2. **Data.** Read and write through the `openapi-fetch` client typed from `packages/api-contract` and TanStack Query hooks in `apps/web/src/api/`. No hand-written request or response types. If the screen needs an operation the contract lacks, stop: that is Phase 3 work, so open a `needs-owner` issue instead of adding an endpoint.
3. **Components.** Build from React Aria Components wrapped in `apps/web/src/ui/`. Reuse an existing wrapper before making a new one. No other component library.
4. **Styling.** Tailwind utilities that resolve to the tokens in `apps/web/src/styles/tokens.css` only: no hex, rgb or hsl values, no arbitrary values like `w-[37px]`, no stock Tailwind palette names. A new visual need adds a token first, in the same PR.
5. **Every state.** Loading (skeleton, not a spinner over a blank page), empty (says what to do next, with the action), error (plain message from the problem `title`, never raw JSON, with a retry), and offline (banner; writes other than session logging are disabled with the reason shown).
6. **Accessibility (WCAG 2.2 AA).** One `h1` per screen; landmarks; every control has a visible label; focus is visible and lands somewhere sensible after navigation and dialogs; targets at least 24 by 24 CSS px; contrast passes in light and dark; nothing depends on colour alone; motion respects `prefers-reduced-motion`.
7. **No note content outside the API.** Never log, `console.*`, put in a URL, a page title, a Faro attribute or an error message: note text, transcripts, insights, quotes, reviews, questions or answers. Route patterns, not real URLs, go to telemetry.
8. **Tests.** A Playwright spec in `test/e2e/<feature>.spec.ts` against the local stack and real API, signed in as a seeded test user (`bt-test-alice`), with `await expectNoAxeViolations(page)` after each state the test reaches. Cover: the main path, empty state, an API error, offline where the screen has offline behaviour, keyboard-only use of the main action, and that user B's data never appears for user A. Pure logic goes in Vitest next to the code. No fixed waits; wait for roles and text.
9. **Demo video.** A `test/e2e/demo/<feature>.demo.ts` walking the feature on seeded data, and a script in `docs/videos/<feature>.txt` in ASD-STE100 Simplified Technical English. CI records and voices it (ADR 0009).
10. **PR.** One screen or one shared component per PR. Body: summary, screenshots in light and dark from seeded data (from `ui-diff` if it runs, otherwise from Playwright), test plan, and the `## Risk note` section from the `risk-note` skill.

## Not a generic AI site

- No gradient hero banners, glass or blurred cards, floating blobs, or emoji used as icons.
- No marketing copy inside the app ("Supercharge your reading!"); short, plain labels in the reader's voice.
- Book covers and the reader's own words are the visual centre. Use the serif token for book titles and quotes only.
- One accent colour, used for the primary action and the current place, not decoration.
- Real seeded content in every screenshot and demo. Never lorem ipsum or invented brand names.
- Mobile first at 390 px wide, then check 768 px and 1280 px. One primary action per screen, reachable with a thumb.

## Check before pushing

`npm run format:check && npm run lint && npm run typecheck && npm test && npm run test:e2e -- <feature>`. Open the screen in light and dark at 390 px and look at it before opening the PR.
