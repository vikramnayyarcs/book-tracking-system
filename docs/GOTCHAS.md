# Gotchas

Log a trap the moment a debugging detour ends, so nobody (human or AI) hits it twice. Newest first.

Format:

```
## YYYY-MM-DD: short title
**The trap in one bold sentence.**
Fix: what to do instead.
```

## 2026-11-20: R2 must be enabled by hand, and its S3 endpoint lags
**Creating an R2 bucket fails with 403 "Please enable R2 through the Cloudflare Dashboard" (code 10042) until R2 is switched on for the account, and right after that the account's S3 endpoint fails TLS handshakes for about 30 seconds.**
Fix: enable R2 once in the dashboard (R2 Object Storage, Get started); it is an account sign-up step, not a setting Terraform can manage. The bootstrap workflow retries the state migration for up to a minute to ride out the endpoint delay.

## 2026-11-20: Old gh versions fail on pr edit and pr view
**`gh` 2.51 and earlier fail on `gh pr edit` and some `gh pr view` calls with "Projects (classic) is being deprecated", because they still query a removed GraphQL field.**
Fix: `winget upgrade GitHub.cli`. Until then, use the REST API, for example `gh api -X PATCH repos/<owner>/<repo>/pulls/<n> -f base=main`. In Git Bash, drop the leading slash from `gh api` paths, or they are rewritten as Windows file paths.

## 2026-11-20: VS Code opened from GitHub Desktop keeps an old PATH
**VS Code launched from GitHub Desktop ("Open in Visual Studio Code") inherits GitHub Desktop's environment, so tools installed after GitHub Desktop started (winget installs, PATH edits) stay invisible to Claude Code, its hooks and its MCP servers, even after restarting VS Code.**
Fix: quit GitHub Desktop and VS Code, then reopen. Check with `gitleaks version` in a new VS Code terminal. Symptoms: hooks report a tool as missing, or an MCP server fails with "Connection closed".

## 2026-11-20: Stacked PRs merge into their base branch, not main
**A PR whose base is another PR's branch merges into that branch; if the lower PR merged first and its branch was not deleted, the upper PR's commits never reach `main`.**
Fix: after a lower PR merges, retarget the next one with `gh pr edit <n> --base main` before merging it. "Automatically delete head branches" in repo settings (managed by Terraform) makes GitHub retarget automatically.
