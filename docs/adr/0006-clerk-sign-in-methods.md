# ADR 0006: Clerk sign-in methods for development

- Status: Accepted
- Date: 2026-11-21
- Decider: Vikram Nayyar
- Method: owner's answer to issue #36

## Context

ADR 0003 said the Clerk development instance signs users in with an email link and Google only. The `clerk-check` job (issue #36) found the live instance differed: email link was not the sign-in method, password was on, and Apple was on.

## Decision

- **Password sign-in is off** (changed in the Clerk dashboard on 2026-11-21).
- **Apple stays on** alongside Google; the owner added it for later use.
- **Email sign-in and verification stay as they are live**, rather than forcing email link. A Playwright run of the sign-in flow in Phase 4 will show whether this causes a problem.
- `infra/clerk-checklist.md` and the `clerk-check` job record the live settings; this replaces the Clerk sign-in bullet in ADR 0003.

## Consequences

- The PWA's sign-in screen (Phase 4) offers email, Google and Apple.
- Apple needs its own credentials before production; the development instance uses Clerk's shared ones.
