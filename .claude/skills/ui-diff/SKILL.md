---
name: ui-diff
description: Before and after visual review of a UI change in apps/web, with Playwright screenshots from main and from the branch. Use for any PR that changes a screen, a component or the design tokens, so the owner sees the change in light and dark, on phone and desktop, without third-party code or any upload.
---

# UI diff

Our own skill. It replaces the third-party `imuratalpay/ui-diff`, which refuses public repositories. No third-party code runs and nothing leaves the machine. Rules: `CLAUDE.md` and the `pwa-screen` skill.

## When

Any PR that changes a route, a component in `apps/web/src/ui/`, or `apps/web/src/styles/tokens.css`. Skip it for PRs with no visible change.

## Capture

The helper is `test/e2e/ui-diff/capture.ui-diff.ts`, run through `playwright.web.config.ts` with `PW_SUITE=ui-diff`. It signs in as `bt-test-alice` with `signInAs` (`test/e2e/sign-in-as.ts`). For each route it takes a full-page screenshot at 390x844 (mobile) and 1280x800 (desktop), in light and dark, at `deviceScaleFactor` 2. It calls `expectNoAxeViolations` (`test/e2e/axe.ts`) on every route before each shot. Motion is reduced.

Inputs, all environment variables:

- `UI_DIFF_ROUTES`: comma-separated paths, for example `/,/search,/books/new`.
- `UI_DIFF_OUT`: output folder outside the repository, for example `../ui-diff-out`.
- `UI_DIFF_LABEL`: `before` or `after`.

Steps:

1. Start the local stack and seed it, as for `npm run test:e2e:web`. Use seeded data only: never real notes. For a route with a param, use a seeded book id.
2. On `main`, in a separate worktree (`git worktree add ../ui-diff-main origin/main`): run `UI_DIFF_ROUTES=... UI_DIFF_OUT=... UI_DIFF_LABEL=before PW_SUITE=ui-diff npx playwright test --config playwright.web.config.ts`. The helper does not exist on older `main` commits: copy `test/e2e/ui-diff/` and the `PW_SUITE=ui-diff` lines of `playwright.web.config.ts` from the branch.
3. On the branch, the same command with `UI_DIFF_LABEL=after`.
4. Files are `<out>/<label>/<route>.<mobile|desktop>.<light|dark>.png`. Compare the pairs side by side.

States the seeded user does not reach by default (loading, empty, error, offline) need their own shot: reach them with route interception or `context.setOffline(true)` and screenshot there.

## Where files go

Never commit screenshots. Attach them to the PR, the same as demo videos. Capture only the routes the change touches.

## Review checklist

- Tokens only: no hex, rgb, hsl, arbitrary values or stock palette names; a new visual need added a token first.
- Every state looks right: loading skeleton, empty with its action, error with retry, offline banner.
- Contrast passes in light and dark; nothing relies on colour alone.
- Focus is visible; tab through the main action.
- Primary actions are at least 44 px tall on mobile (24 px is the WCAG 2.2 AA minimum).
- No note text, transcript, insight, quote or answer from a real reader in any screenshot; seeded data only.
- Nothing overflows at 390 px; layout follows `pwa-screen` (bottom bar below 1100 px, side nav above).

## PR body

Under the summary, add a `## Visual diff` section: one line per route and what changed (for example "Shelf, mobile light: row spacing now uses `--spacing-md`"), what did not change, and which checklist items you verified. Attach the before and after images to the PR, named as the files above. Then add the `## Risk note` section from the `risk-note` skill.
