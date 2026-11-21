---
name: correct
description: Turn a mistake the owner keeps correcting into something the repo enforces, so no later agent can repeat it. Use when the owner corrects an agent for something that has happened before, or asks to "make this impossible", "stop agents doing X", or for /correct.
disable-model-invocation: true
---

# Correct

Assume every future change is made by an agent that has read only the files it opened, copies the nearest example, and takes the shortest path that passes CI. A rule written only in prose will be skipped. Make the wrong change fail.

## 1. Name the mistake class

Collect the evidence: the owner's correction, review comments, reverted commits, `docs/GOTCHAS.md`, and earlier PRs where it happened. A class counts once it has happened twice; a one-off goes in `docs/GOTCHAS.md` instead.

## 2. Fix it at the highest level that works

Try these in order and stop at the first that makes the mistake impossible:

1. **Design.** One owner for each piece of state, one supported way to do each task. Delete the old way and dead code an agent could copy. Replace hand-kept lists with a single source of truth.
2. **Types and database constraints.** Make the bad state unrepresentable: TypeScript types, `check` constraints, column grants, RLS.
3. **A check that names the fix.** An Oxlint or Landmines rule, a Claude Code hook in `scripts/claude-hooks/`, or a CI step whose error message says what to use instead. If the pattern already exists in the repo, fail only on new occurrences.
4. **A test** that fails when the behaviour breaks and passes when only internals change.
5. **Docs or `CLAUDE.md`**, last, and only for judgment calls nothing can check.

## 3. Prove it

Show the new check failing on a real past instance of the mistake (the commit or PR it came from), then passing on the fix. The same command must run locally and in CI.

## 4. Record it

Add one line to the enforcement table in `CLAUDE.md`: the rule and what enforces it. If the rule was already listed with nothing enforcing it, this is a repeat: fix it at a higher level in the same PR. Remove a line once its mistake can no longer happen.

## Reply

For each class: the evidence, the level chosen, why a higher level didn't work, and the proof that the check fails on the real mistake.
