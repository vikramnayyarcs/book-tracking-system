---
name: adr
description: Write an architecture decision record in docs/adr/. Use after a /grill-me session, or whenever a choice would be costly to reverse (a provider, a data shape, a security trade-off, a phase plan).
---

# Write an ADR

An ADR records a decision that has already been made, why, and what it costs. It is not a proposal. If decisions are still open, run `/grill-me` first.

## Steps

1. List `docs/adr/` and take the next number, zero-padded to four digits. File name: `NNNN-short-kebab-title.md`.
2. Write it with the template below. Keep it to what a future reader needs to understand or reverse the decision.
3. If it changes a rule in `CLAUDE.md` or a fact in `docs/requirements.md`, update that file in the same PR, as a separate commit.
4. If it replaces an earlier ADR, set the old one's status to `Superseded by ADR NNNN`. That status line is the only edit allowed to an accepted ADR.
5. Commit the ADR on its own: `Add ADR NNNN: <title>`.

## Template

```markdown
# ADR NNNN: Title

- Status: Accepted
- Date: YYYY-MM-DD
- Decider: Vikram Nayyar
- Method: how it was decided (for example, `/grill-me` session)

## Context

The situation and constraints, in a few sentences. Link to `docs/requirements.md` rather than restating it.

## Decision

What was decided, grouped under short headings. Use tables for lists of resources or options. Name exact files, resources and variable names.

## Consequences

What becomes easier, what becomes harder, accepted risks, and the triggers that would make us revisit.
```

## Rules

- Plain, direct sentences. No marketing tone.
- Never hard-code the product name; say "the product" or use the config names from `packages/core/src/brand.ts`.
- No secret values, tokens or account IDs, only the names of the variables that hold them.
- Record rejected options only when someone is likely to propose them again, with one line on why not.
