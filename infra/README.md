# Infrastructure

Terraform for every environment. Applies run only in GitHub Actions (ADR 0002); locally you may run `fmt`, `validate` and `plan`.

| Path | What |
| --- | --- |
| `bootstrap/` | R2 bucket holding all Terraform state, plus a token that can only read and write that bucket |
| `envs/dev` | Dev environment, applied by `deploy-dev.yml` on every merge to main. Also owns the GitHub repo settings, which are shared by all environments |
| `envs/prod` | Production: `site-prod`, the prod Supabase project and the zone module (off until `domain` is set). Validated in CI, never planned in PRs; applied only by `release-prod.yml`, which fails unless the repo variable `PROD_ENABLED` is `true`. The Grafana stack is shared and owned by the dev root |
| `modules/github-repo` | Repo settings: merge commits only, delete branch on merge, Dependabot, SHA-pinned allowlisted actions, read-only workflow token |
| `modules/cloudflare-pages` | One direct-upload Pages project (`site-dev` on `pages.dev`); `deploy-dev.yml` uploads the built site with `wrangler pages deploy` |
| `modules/cloudflare-zone` | Zone-wide WAF custom rules and the rate limiting rule. Prod only; off until `domain` is set. The Cloudflare token needs Zone edit and Zone WAF edit |
| `modules/cloudflare-site-domain` | One host name pointed at one Pages project (DNS record and Pages custom domain). Prod: apex and `www` to `site-prod`; dev: `dev.<domain>` to `site-dev`. Off until `domain` is set; the token also needs DNS edit |
| `modules/supabase-project` | Dev Supabase project (`eu-west-2`, free), generated database password, Clerk registered as third-party auth, connection details written to `DEV_SUPABASE_*` repo secrets |
| `modules/grafana-stack` | Imports the existing Grafana Cloud stack (never creates one), an OTLP write token written to `GRAFANA_OTLP_*` repo secrets, a synthetic HTTP check on the site, and the `web-<env>` Grafana Faro app. Its provider needs the Frontend Observability scopes on the token, passed as `GRAFANA_FRONTEND_O11Y_API_ACCESS_TOKEN` |
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

## What Terraform cannot reach

**Vault secrets `jobs_url` and `jobs_secret` (dev).** `pg_cron` jobs read these from Supabase Vault to call the internal jobs route of the `api` function. No Terraform provider resource runs SQL or manages Vault, so Terraform cannot write them. One idempotent step in `deploy-dev.yml` ("Upsert the jobs settings into Vault") runs after the migrations, reads the `jobs_url` and `jobs_secret` Terraform outputs, masks the secret in logs and upserts both values. The same `random_password.jobs_secret` also feeds the Edge Function secret `JOBS_SECRET`, so there is one source for both. Never write these values by hand; to rotate, change the `random_password` and let the workflow run. Prod has no jobs yet; when it gets them, add the same outputs to `envs/prod` and the same step to `release-prod.yml`.

## Grafana alerts and dashboard

The `grafana-stack` module creates a service account in the stack (`terraform-alerting`) and uses its token to manage alert rules, one email contact point, the notification policy and the `API overview` dashboard. Alerts: API 5xx rate, p95 latency, AI token spike, nudge job failure, Edge Function errors. The email comes from the `GRAFANA_ALERT_EMAIL` repo secret; unset skips all of it. Rules read these Prometheus metrics, which the API, nudge job and Edge Functions must export over OTLP with an `env` label: `api_requests_total` (label `status_class`), `api_request_duration_seconds` (histogram), `ai_tokens_total`, `nudge_job_runs_total` (label `result`), `edge_function_errors_total`. Missing data counts as OK, so rules stay quiet until the metrics exist.
