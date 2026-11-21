# Infrastructure

Terraform for every environment. Applies run only in GitHub Actions (ADR 0002); locally you may run `fmt`, `validate` and `plan`.

| Path | What |
| --- | --- |
| `bootstrap/` | R2 bucket holding all Terraform state, plus a token that can only read and write that bucket |
| `envs/dev` | Dev environment, applied by `deploy-dev.yml` on every merge to main. Also owns the GitHub repo settings, which are shared by all environments |
| `envs/prod` | Production (later PR; applied only through `release-prod.yml`) |
| `modules/github-repo` | Repo settings: merge commits only, delete branch on merge, Dependabot, SHA-pinned allowlisted actions, read-only workflow token |
| `modules/cloudflare-pages` | One direct-upload Pages project (`site-dev` on `pages.dev`); `deploy-dev.yml` uploads the built site with `wrangler pages deploy` |
| `modules/cloudflare-zone` | DNS, Pages custom domains, WAF custom rules and the rate limiting rule for the apex domain. Off until `domain` is set in the dev root; the Cloudflare token then also needs Zone edit, DNS edit and Zone WAF edit |
| `r2.tfbackend` | Shared S3-backend settings for R2; each root names its own `key` |

## Bootstrap (once)

1. Enable R2 once: Cloudflare dashboard, R2 Object Storage, Get started. Terraform cannot do this.
2. Set the five values in sections 1 and 2 of `docs/secrets.md` (Cloudflare token and account ID, GitHub App ID, installation ID and private key).
3. Actions → **Bootstrap Terraform state** → Run workflow, leaving `recover_run_id` empty.

The first run creates the bucket using local state, writes `TF_STATE_R2_ACCESS_KEY_ID` and `TF_STATE_R2_SECRET_ACCESS_KEY` to the repo secrets, and moves its own state into the bucket. Later runs plan and apply against R2.

### If the first run fails after creating resources

The run attaches its local state as the `bootstrap-local-state` artifact for one day. Re-run the workflow with `recover_run_id` set to the failed run's ID (the number in its URL). It restores that state, re-applies (no changes) and retries the move into R2. Do not delete anything in the Cloudflare dashboard.

## Local checks

```sh
terraform fmt -recursive infra
terraform -chdir=infra/bootstrap init -backend=false
terraform -chdir=infra/bootstrap validate
```

After changing a provider version, refresh the lock file for both platforms, or CI on Linux rejects it:

```sh
terraform -chdir=infra/<root> providers lock -platform=windows_amd64 -platform=linux_amd64
```
