# ADR 0005: PR risk traffic lights and automatic merging of green PRs

- Status: Accepted
- Date: 2026-11-21
- Decider: Vikram Nayyar
- Method: four questions in the main session, answered in chat

## Context

Unattended runs (ADR 0004) open many PRs; the owner reviews and merges each one. Documentation-only PRs carry little risk but cost the same review time. The owner wants low-risk PRs merged automatically, without letting a session merge its own work.

## Decision

### Who decides

A GitHub workflow decides a PR's colour from fixed rules: which files it touches and how many lines change. The session that wrote the PR has no say. The workflow runs on `pull_request_target`, so it always uses the rules on `main`, and it never checks out or runs the PR's code; a PR cannot change the rules that judge it.

### The rules

| Colour | When |
| --- | --- |
| **Red** | Any file under `infra/`, `.github/`, `scripts/claude-hooks/`, `scripts/git-hooks/`, `supabase/migrations/`; `.claude/settings*.json`, `.mcp.json`, `scripts/cloud-setup.sh`, `CLAUDE.md`, `docs/secrets.md` |
| **Green** | Every file is documentation (`docs/**` except `docs/adr/`, `docs/briefs/` and `docs/secrets.md`; `README.md`) or a project skill (`.claude/skills/**`), with at most 300 lines changed, targeting `main` |
| **Yellow** | Everything else: application and test code, ADRs, briefs, dependency changes |

The first matching row wins, top to bottom. The workflow labels the PR `risk:red`, `risk:yellow` or `risk:green` and keeps one comment explaining which files set the colour. Red PRs that touch `infra/` or `.github/` say that merging changes real infrastructure or CI.

### Who merges

- **Green:** a second workflow merges it (merge commit) once CI has passed on the latest commit and every other check on that commit has passed. Before merging it reclassifies from scratch and checks the head commit has not moved. Claude still never merges; the `block-merges` hooks are unchanged.
- **Yellow and red:** the owner, as before.

### Risk note

A project skill adds a short written risk assessment to each PR to help the owner review yellow and red PRs. It is adapted from a published PR-risk skill after reading it in full, or written small if none fits. The colour always comes from the workflow, never the skill.

## Consequences

- Documentation PRs merge without the owner; a wrong doc can land unreviewed. Docs that steer agents (ADRs, briefs, CLAUDE.md, secrets guidance) are excluded for that reason.
- Merges made with the workflow's token do not trigger other workflows; green PRs never need a deploy, so this is intended.
- Changing the rules is itself a red PR.
- Stacked green PRs wait until they target `main`.
