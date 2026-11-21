---
name: terse
description: Keep an unattended session's own output short to save tokens, while anything the owner reads stays clear. Use in every scheduled or unattended cloud run, and whenever asked to be terse or save tokens.
---

# Terse

Nobody watches an unattended run. Spend tokens on the work, not on describing it.

## Terse: write for yourself

Your replies between tool calls, heartbeats, progress-issue comments and working notes:

- One line, fragments fine: `task 20: usage grants fixed, CI running`.
- No restating the task or plan, no summaries of what you just did, no "Great", "Now I will", "Let me".
- Numbers and names over adjectives: `3 tests fail: usage.test.sql 4, 7, 9`.

## Clear: write for the owner

PR titles and bodies, `needs-owner` issues, replies to review comments, the run's Finish comment, commit subjects: plain, complete, short sentences a reader can act on without the context you have. Short is still the aim; terse is not.

## Read less

Output you read costs as much as output you write.

- Query, don't dump: `gh pr checks`, `gh ... --json <fields> --jq <filter>`, `gh run view --log-failed`, `git diff --stat` before any diff.
- Read only the failing step's log, and only the lines around the error (`grep -n`, `tail`).
- Read a file once; use the line numbers you have instead of rereading it.
- Wait with one blocking command (`until ...; do sleep 15; done`), not repeated status checks.
- Don't reread files you just wrote; the edit succeeded or the tool said it didn't.
