# Claude Code cloud environment

How to set up the cloud environment that runs unattended sessions (for example overnight) against this repo.

## Read this first

**Run cloud sessions on this repository alone, never inside a project thread and never with several repositories.** In those two cases Claude Code does not load `.claude/settings.json`, so none of the guard hooks run: nothing would stop a merge, a push to `main`, a local deploy or a commit without a secrets scan.

Unattended sessions only open PRs. Nothing reaches real infrastructure until the owner merges.

## Create the environment (once)

At claude.ai/code → **Environments** → **New environment**:

1. **Name:** `book-tracking-dev`.
2. **Repository:** `vikramnayyarcs/book-tracking-system`. Install the Claude GitHub App on this repository only, if prompted.
3. **Network access:** **Limited**, with **Allow package managers** ticked. In **Allowed domains**, one per line:

   ```
   nodejs.org
   releases.hashicorp.com
   registry.terraform.io
   objects.githubusercontent.com
   release-assets.githubusercontent.com
   mcp.context7.com
   cdn.playwright.dev
   playwright.download.prss.microsoft.com
   ```

   Add Supabase and Grafana domains only when a task needs them. Sessions never call Cloudflare, Supabase or GitHub APIs to change infrastructure; that happens in Actions after a merge.

4. **Environment variables:** none yet. When the GitHub MCP server is added, set `BT_GITHUB_MCP_TOKEN` here with the same read-only value as on Windows.
5. **Setup script:** paste the whole of `scripts/cloud-setup.sh`. It installs pinned Node, Terraform, gitleaks and terraform-mcp-server, checking each download's SHA-256. When it finishes within about five minutes, the result is cached for later sessions.

The same script also runs from the SessionStart hook in every cloud session, so a session still gets the tools if the cache is cold; it skips anything already installed. When you change the script in the repo, paste the new version into the environment too.

## Check a new environment

Start a session in the environment and ask:

> Run `gitleaks version`, `terraform version`, `node --version`, `docker info --format '{{.ServerVersion}}'` and `npm test`, then try `gh pr merge 1` and report what the hooks did.

Expected: Gitleaks 8.30.1, Terraform 1.17.1, Node 24.22.3, a Docker server version (or a note that the daemon needs starting), tests passing, and the merge blocked by the `block-merges` hook.

## Limits

About 4 vCPUs, 16 GB RAM and 30 GB disk per session. A session pauses after a few minutes of inactivity; long work should keep running commands or be split into tasks that each end in a PR.
