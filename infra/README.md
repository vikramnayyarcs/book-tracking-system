# Infrastructure

Terraform for every environment. Applies run only in GitHub Actions (ADR 0002); locally you may run `fmt`, `validate` and `plan`.

| Path | What |
| --- | --- |
| `bootstrap/` | R2 bucket holding all Terraform state, plus a token that can only read and write that bucket |
| `envs/dev`, `envs/prod` | One root per environment (later PRs) |
| `modules/` | Shared modules (later PRs) |
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
