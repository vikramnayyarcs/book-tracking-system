# Gotchas

Log a trap the moment a debugging detour ends, so nobody (human or AI) hits it twice. Newest first.

Format:

```
## YYYY-MM-DD: short title
**The trap in one bold sentence.**
Fix: what to do instead.
```

## 2026-11-20: VS Code opened from GitHub Desktop keeps an old PATH
**VS Code launched from GitHub Desktop ("Open in Visual Studio Code") inherits GitHub Desktop's environment, so tools installed after GitHub Desktop started (winget installs, PATH edits) stay invisible to Claude Code, its hooks and its MCP servers, even after restarting VS Code.**
Fix: quit GitHub Desktop and VS Code, then reopen. Check with `gitleaks version` in a new VS Code terminal. Symptoms: hooks report a tool as missing, or an MCP server fails with "Connection closed".

## 2026-11-20: Stacked PRs merge into their base branch, not main
**A PR whose base is another PR's branch merges into that branch; if the lower PR merged first and its branch was not deleted, the upper PR's commits never reach `main`.**
Fix: after a lower PR merges, retarget the next one with `gh pr edit <n> --base main` before merging it. "Automatically delete head branches" in repo settings (managed by Terraform) makes GitHub retarget automatically.
