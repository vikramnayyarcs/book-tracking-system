# ADR 0004: Unattended cloud runs and PR videos

- Status: Accepted
- Date: 2026-11-21
- Decider: Vikram Nayyar
- Method: decided while finishing Phase 1 setup (20 and 21 November)

## Context

The owner wants Claude Code to build from the requirements and ADRs in an unattended cloud session, with the owner reviewing and merging. GitHub Free gives a private repo no branch protection (ADR 0002), so the guard rails have to come from hooks and process. CLAUDE.md also asks for a demo and/or voiced explainer video on every feature PR.

## Decision

### Merging and branches

- **Merge commits only** (squash and rebase off), set by Terraform. This replaces ADR 0002's "squash merge only": stacked PRs stay conflict-free with merge commits.
- **Delete branch on merge** is on; GitHub then retargets PRs stacked on a merged branch. Any branch whose PR has merged is deleted, remote and local.
- Work that depends on an unmerged PR goes on a branch stacked on it.

### What a session may do

- **Claude never merges PRs, triggers or re-runs workflows, or pushes to `main`.** The `block-merges` hook enforces this; the owner merges, and merging is what deploys to dev.
- The other hooks still apply: no local deploys, no edits to `.env` files or applied migrations, a secrets scan before every commit, lint and typecheck after every edit.
- A session never starts a phase that has no accepted ADR. It stops and leaves a note.

### Cloud environment

- One environment, `book-tracking-dev`, set up per `docs/cloud-environment.md`: limited network with a short allowlist, and `scripts/cloud-setup.sh` as the setup script.
- **Sessions run on this repository alone, never in a project thread or with several repositories**, because Claude Code does not load `.claude/settings.json` there and the hooks would not run.
- The SessionStart hook runs the same script in every session: pinned Node 24, Terraform, gitleaks and terraform-mcp-server, `npm ci`, and starting Docker for the local Supabase stack.
- About 4 vCPUs, 16 GB RAM and 30 GB disk per session; enough for the local Supabase stack.

### PR videos

Every PR with a feature change carries both:

1. **Demo:** the Playwright E2E run for the feature records video.
2. **Explainer:** Claude writes a short script in ASD-STE100 Simplified Technical English; **Piper** (open-source, offline text-to-speech, no API key) voices it; **ffmpeg** joins voice and recording into an MP4.

CI builds both and uploads them as a workflow artifact, linked from the PR; videos are never committed. A lint checks the rules a script can check (sentence length, one instruction per sentence); Claude follows the vocabulary rules. Videos use seeded test data only. The pipeline is built with the first feature PR, the marketing site.

## Consequences

- Hooks are the only thing stopping a session merging its own work. Running in a project thread or multi-repo session would silently remove them; `docs/cloud-environment.md` says so first.
- The owner reviews every PR before anything deploys; throughput is limited by review.
- Artifacts expire (90 days at most), so videos are for review, not a permanent record.
- Piper's voice is plain; Kokoro is the upgrade path if it matters.
