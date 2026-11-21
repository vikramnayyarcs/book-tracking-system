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
   api.githubcopilot.com
   cdn.playwright.dev
   playwright.download.prss.microsoft.com
   api.groq.com
   openlibrary.org
   ```

   `api.groq.com` lets a session record MSW fixtures and run the DeepEval set; `openlibrary.org` lets it record ISBN lookup fixtures. Add Supabase and Grafana domains only when a task needs them. Sessions never call Cloudflare, Supabase or GitHub APIs to change infrastructure; that happens in Actions after a merge.

4. **Environment variables:** `BT_GITHUB_MCP_TOKEN`, the same read-only fine-grained token as on Windows (`docs/secrets.md`). `.mcp.json` sends it to GitHub's remote MCP server (`https://api.githubcopilot.com/mcp/`) as `${BT_GITHUB_MCP_TOKEN:-}` with the `X-MCP-Readonly: true` header, so it only offers read tools; if the variable is missing the session still starts and the GitHub server simply fails to connect.

   `GROQ_API_KEY`, the same dev key as the `DEV_GROQ_API_KEY` repo secret. Sessions use it only to record fixtures from invented notes and to score evals (ADR 0007).
5. **Setup script:** paste the whole of `scripts/cloud-setup.sh`. It installs pinned Node, Terraform, gitleaks and terraform-mcp-server, checking each download's SHA-256. When it finishes within about five minutes, the result is cached for later sessions.

The same script also runs from the SessionStart hook in every cloud session, so a session still gets the tools if the cache is cold; it skips anything already installed. When you change the script in the repo, paste the new version into the environment too.

What the SessionStart run adds on top of the setup script:

- **Node 24 wins on PATH.** The image puts its own Node 22 (`/opt/node22/bin`) ahead of `/usr/local/bin`. When `CLAUDE_CODE_REMOTE` is `true` (always so for the SessionStart hook), the script links `node`, `npm`, `npx` and `corepack` in any such folder to the pinned ones, so hooks run on Node 24. Anywhere else it only warns, because linking replaces files the script does not own. It also adds `/usr/local/bin` to the front of the session shell's PATH through `CLAUDE_ENV_FILE`.
- **`npm ci`** when `node_modules` is missing.
- **Docker.** The image has `dockerd` but does not start it. The script starts it in the background (log: `/tmp/dockerd.log`) and waits up to 60 seconds. If Docker does not come up, the script prints the end of the log and the session starts without it.

## Check a new environment

Start a session in the environment and ask:

> Run `gitleaks version`, `terraform version`, `node --version`, `docker info --format '{{.ServerVersion}}'` and `npm test`, then try `gh pr merge 1` and report what the hooks did.

Expected:

- `gitleaks version`: 8.30.1
- `terraform version`: Terraform v1.17.1. A refused connection to `checkpoint-api.hashicorp.com` is only the update check and does no harm.
- `node --version`: v24.22.3
- `docker info`: a server version (29.10.0 when last checked). If it fails, read `/tmp/dockerd.log`.
- `npm test`: all tests pass.
- `gh pr merge 1`: blocked by the `block-merges` hook before it runs.

`docker run --rm hello-world` should also print "Hello from Docker!"; Docker Hub is reachable with **Allow package managers** ticked.

## Limits

About 4 vCPUs, 16 GB RAM and 30 GB disk per session. A session pauses after a few minutes of inactivity; long work should keep running commands or be split into tasks that each end in a PR.
