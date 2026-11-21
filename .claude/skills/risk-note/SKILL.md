---
name: risk-note
description: Write the risk note for a pull request, so the owner can review a yellow or red PR quickly. Finds what the change could break beyond its diff and proves the one fact it is safe because of by running real code. Use when opening or updating a yellow or red PR, or when asked "what could this break" or for the blast radius of a change.
---

# Risk note

The PR's colour (red, yellow, green) comes from the `PR risk` workflow, never from you (ADR 0005). This note helps the owner review; it does not change the colour.

A note that only sounds right is worthless: it reads as convincing whether or not it is true. Find the one or two facts the change's safety depends on and prove them.

## Steps

1. **Read the change**, including what it now does differently that the diff doesn't spell out. For `infra/` changes, read the `plan-dev` summary; any "destroy" or "must be replaced" line is the first risk.
2. **Find the one fact it is safe because of.** Most risky-looking changes are safe because of a single fact (for example "this migration only adds a column with a default" or "the new rule is scoped to the site's hostnames"). Spend your time here, not on a list of maybes.
3. **Look where a text search stops:** library source at its pinned version, database grants and RLS policies, workflow triggers and their permissions, JSON shapes another component reads, Terraform resources another root also manages.
4. **Prove the fact** as far down this list as is cheap, and say where you stopped:
   1. asserted (worthless alone);
   2. pointed at a real `file:line`;
   3. walked the failure step by step and showed it can't happen;
   4. ran it: a test or script that calls the real code and fails loudly if you are wrong (a pgTAP test, a Vitest test, `terraform plan`);
   5. reproduced it in the running dev environment.
5. **Rate each real risk** by how likely and how bad, with the `file:line` and how to check. List what you checked and cleared separately. Never invent a caller or an API.

## Add it to the PR

Append a section to the PR body (keep the owner-facing style: plain, short sentences):

```markdown
## Risk note
**Safe because:** <the one fact>. Proven: <level reached, and the test or command that shows it>.
**Risks:** <risk, file:line, likelihood and cost, how to check>, or "none found".
**Cleared:** <what was checked and why it's fine>.
**Before merging:** <the cheapest check the owner can do, if any>.
```

If the fact could not be proven, write **Unproven** and say what would prove it.
