# First Claude Code session — Phase 1 kickoff

Already in this folder: CLAUDE.md, README.md, .gitignore, .nvmrc (Node 24), docs/requirements.md, docs/adr/0001-stack-and-build-order.md, docs/GOTCHAS.md.

## Before you start (2 minutes)

1. Open a terminal in this folder and check `node -v` shows v24 (install Node 24 LTS first if not).
2. Run `claude`.

## Paste this as your first message

> Read CLAUDE.md, docs/requirements.md and docs/adr/0001-stack-and-build-order.md. We're starting Phase 1 (Foundations: IaC and CI/CD).
>
> First, run `git init`, make an initial commit of the files already here, and check line endings are sensible for Windows (.gitattributes).
>
> Then install grill-me with skills.sh into this repo (`npx -y skills add mattpocock/skills --skill grill-me --agent claude-code`), show me its SKILL.md, and wait for my OK before committing it.
>
> Then run /grill-me on Phase 1 only. Cover: repo layout and package manager, Terraform bootstrap and R2 state, which Cloudflare/Supabase/GitHub/Grafana resources Phase 1 creates, the GitHub Actions workflows, the .mcp.json servers and the environment variable names they need, Oxlint + Landmines setup (including whether to keep no-comments and no-explicit-return-types), and which hooks to add first.
>
> When we've finished, write docs/adr/0002-phase-1-plan.md, then propose the first small PR. Don't create any cloud resources or run terraform apply.
