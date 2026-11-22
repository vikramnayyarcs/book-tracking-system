# ADR 0010: Specialist agents (QA and security) beside the developer routine

- Status: Accepted
- Date: 2026-11-22
- Decider: Vikram Nayyar
- Method: discussion at the desk after the Phase 4 `/grill-me`
- Amends: ADR 0009 ("Runs", QA agent)

## Context

One unattended routine (the "developer", `book-tracking build runs`) builds tasks from a brief and fixes what it is told about. Nothing independent looks for bugs or security problems in what it ships, and the owner now reviews only red PRs (ADR 0009). Dependabot alerts reach sessions as `dependabot` issues (`.github/workflows/dependabot-issues.yml`).

## Decision

Specialists find; the developer fixes. Specialists never write code, open PRs, or touch infrastructure; they file issues. All routines use Sonnet and the `terse` skill.

| Agent | Schedule | Finds | Files |
| --- | --- | --- | --- |
| Developer (existing) | Hourly | Works the brief | PRs |
| QA | Daily | Drives the dev PWA with seeded test users: every flow, axe, edge cases | `bug` issues with steps and a screenshot |
| Security | Biweekly: cron on the 1st and 15th of each month | Runs the `vulnerability-scanner` skill over changes since its last run; checks RLS policies, `packages/core/src/api/auth.ts`, `apps/web/public/_headers` and workflow permissions against `CLAUDE.md`; triages open `dependabot` issues by real exposure | `security` issues with severity, evidence and a recommended fix |

The owner's Dispatch reports file `bug` issues too.

Developer work order: conflicts, owner comments, failing CI, `security` issues of high or critical severity, `bug`, `dependabot`, other `security`, then the brief's next task. Each fix starts with a failing test that proves the problem.

**When:** both specialists start once the PWA has the app shell, sign-in and `_headers` merged (run 4, task 6), because that is when there is a browser attack surface and screens to test. Routines cannot be created from a cloud session, so the owner and a desk session set them up; the run 4 Finish comment reminds the owner, and issue "Set up QA and security specialist routines" tracks it.

## Consequences

- A second view on every change without owner review. Cost: one Sonnet session a day for QA and two a month for security, on the owner's Claude plan.
- Specialists may file noise. If more than half of a specialist's issues are closed as not useful over a month, tighten its prompt or reduce its schedule.
- Revisit the security schedule (to weekly) if two runs in a row find a high or critical issue, and before launch (Phase 5), when a one-off deeper review is due.
