# Secrets and variables you set by hand

Everything here is created once by hand and stored outside the repo. Anything Terraform can generate, it does (see the last section). Never paste a value into a file, an issue or a chat.

Set GitHub values from this folder with `gh`. It prompts for the value, so it never lands in shell history:

```sh
gh secret set NAME          # secret: hidden after saving
gh variable set NAME        # variable: visible, for IDs that are not secret
```

On GitHub Free private repos there are no Environments, so everything is repo-level. Environment-specific names start with `DEV_` or `PROD_` (ADR 0002).

## Checklist

| When | Name | Kind | Where |
| --- | --- | --- | --- |
| Before the bootstrap workflow (PR 9) | `CLOUDFLARE_API_TOKEN` | Secret | GitHub repo |
| Before the bootstrap workflow (PR 9) | `CLOUDFLARE_ACCOUNT_ID` | Variable | GitHub repo |
| Before the bootstrap workflow (PR 9) | `TF_GITHUB_APP_ID` | Variable | GitHub repo |
| Before the bootstrap workflow (PR 9) | `TF_GITHUB_APP_INSTALLATION_ID` | Variable | GitHub repo |
| Before the bootstrap workflow (PR 9) | `TF_GITHUB_APP_PRIVATE_KEY` | Secret | GitHub repo |
| When you have a Supabase account (PR 13) | `DEV_SUPABASE_ACCESS_TOKEN` | Secret | GitHub repo |
| When you have a Supabase account (PR 13) | `DEV_SUPABASE_ORG_ID` | Variable | GitHub repo |
| When you have a Grafana Cloud account (PR 14) | `GRAFANA_CLOUD_ACCESS_POLICY_TOKEN` | Secret | GitHub repo |
| When you have a Grafana Cloud account (PR 14) | `GRAFANA_REGION` | Variable | GitHub repo |
| When you have a Grafana Cloud account (PR 14) | `GRAFANA_STACK_SLUG` | Variable | GitHub repo |
| Before Phase 2 (ADR 0003) | `DEV_CLERK_FRONTEND_API_URL` | Variable | GitHub repo |
| Before Phase 2 (ADR 0003) | `DEV_CLERK_SECRET_KEY` | Secret | GitHub repo |
| Before Phase 2 (ADR 0003); used in Phase 4 | `DEV_CLERK_PUBLISHABLE_KEY` | Variable | GitHub repo |
| Before Phase 3 (ADR 0007) | `DEV_GROQ_API_KEY` | Secret | GitHub repo; Terraform passes it to Supabase secrets |
| When the GitHub MCP server is added | `BT_GITHUB_MCP_TOKEN` | Env var | Windows user env and cloud session settings |
| When the Grafana MCP server is added | `BT_GRAFANA_DEV_TOKEN` | Env var | Windows user env and cloud session settings |
| At launch only | `PROD_ENABLED` = `true` | Variable | GitHub repo; leave unset until then |

## Key register

Every credential you created by hand, and what to do when it expires or leaks. The `key-check` workflow tests each one nightly against its provider and opens one issue, **Key check failed**, when a key is rejected or expires within 14 days. When you roll a key: create the new one, set it with `gh secret set NAME`, revoke the old one, and note the date below.

| Secret | Provider | Expires | Roll it at | Check calls |
| --- | --- | --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` | Cloudflare | The date you chose; the check reads it | My Profile → API Tokens → Roll | Token verify |
| `TF_GITHUB_APP_PRIVATE_KEY` | GitHub App | Never | App settings → Private keys → Generate | `GET /app` with an app JWT |
| `TF_STATE_R2_ACCESS_KEY_ID`, `TF_STATE_R2_SECRET_ACCESS_KEY` | Cloudflare R2 (made by `infra/bootstrap`) | Never | Re-run bootstrap | List the state bucket |
| `DEV_SUPABASE_ACCESS_TOKEN` | Supabase | The date you chose | Account → Access Tokens | `GET /v1/projects` |
| `GRAFANA_CLOUD_ACCESS_POLICY_TOKEN` | Grafana Cloud | The date you chose; the check reads it | Access Policies → token | Access policy read |
| `DEV_CLERK_SECRET_KEY` | Clerk | Never (roll if leaked) | API keys → Secret keys | `GET /v1/instance` |
| `DEV_GROQ_API_KEY` | Groq | Never (roll if leaked) | console.groq.com → API Keys | `GET /openai/v1/models` |
| `BT_API_TOKEN` (env var, not checked by CI) | This API (personal access token) | The date you set, or never | Create a new token with `POST /v1/tokens`, then revoke the old one | None |
| `BT_CLERK_SECRET_KEY` (env var, not checked by CI) | Clerk | Never (roll if leaked) | API keys → Secret keys; use the dev instance key, same value as `DEV_CLERK_SECRET_KEY` | None |
| `BT_GITHUB_MCP_TOKEN` (env var, not checked by CI) | GitHub fine-grained PAT | The date you chose | Settings → Developer settings → PATs | None; MCP fails to start |

Last rolled: `CLOUDFLARE_API_TOKEN` 2026-11-21 (after it leaked in chat). Everything else: first set 2026-11-20 or 2026-11-21.

Secrets made by Terraform (Supabase keys, Grafana OTLP, the gateway secret) are not listed: Terraform replaces them.

## 1. Cloudflare API token

Terraform's root credential for Cloudflare.

1. Cloudflare dashboard → **My Profile → API Tokens → Create Token → Custom token**.
2. Name: `terraform-github-actions`.
3. Permissions, all under **Account**:
   - **Workers R2 Storage: Edit** (state bucket)
   - **Cloudflare Pages: Edit** (site projects)
   - **Account API Tokens: Edit** (bootstrap mints a separate token that can only read and write the state bucket)
4. Account Resources: **Include → your account**. No zone permissions yet; they are added when a domain exists.
5. `gh secret set CLOUDFLARE_API_TOKEN` and paste the token.
6. Account ID: dashboard → **Workers & Pages**, right-hand column. `gh variable set CLOUDFLARE_ACCOUNT_ID`.

## 2. GitHub App for Terraform

Lets Terraform manage this repo's settings and secrets without a personal token that expires.

1. GitHub → **Settings → Developer settings → GitHub Apps → New GitHub App**.
2. Name: anything unique, for example `bt-terraform-vikramnayyarcs`. Homepage URL: the repo URL.
3. **Webhook: untick Active.**
4. Repository permissions:
   - **Administration: Read and write**
   - **Secrets: Read and write**
   - **Dependabot alerts: Read and write**
   - Metadata: Read (set automatically)
5. Where can this app be installed: **Only on this account**. Create.
6. Note the **App ID** at the top of the page. `gh variable set TF_GITHUB_APP_ID`.
7. **Generate a private key**; a `.pem` downloads. `gh secret set TF_GITHUB_APP_PRIVATE_KEY < path/to/key.pem`, then store the file in your password manager and delete it from Downloads.
8. **Install App** → only select `book-tracking-system`. The installation ID is the number at the end of the URL you land on (`/settings/installations/<id>`). `gh variable set TF_GITHUB_APP_INSTALLATION_ID`.

## 3. Supabase (when you have an account)

1. Supabase dashboard → **Account → Access Tokens → Generate new token**, named `terraform-github-actions`. `gh secret set DEV_SUPABASE_ACCESS_TOKEN`.
2. **Organization settings → General → Organization slug/ID.** `gh variable set DEV_SUPABASE_ORG_ID`.

Supabase personal tokens reach every project in your account, prod included once it exists. The `DEV_` prefix is about which workflows use it, not what it can touch.

## 4. Grafana Cloud (when you have an account)

1. grafana.com → **My Account → Security → Access Policies → Create access policy**, named `terraform`, realm: your org.
2. Scopes: **stacks: read, write, delete** and **accesspolicies: read, write, delete**.
3. **Add token** → copy it. `gh secret set GRAFANA_CLOUD_ACCESS_POLICY_TOKEN`.
4. Pick the region closest to London from the stack-creation page and save its slug: `gh variable set GRAFANA_REGION`.

## 5. Clerk (development instance)

Clerk has no Terraform provider; its settings are recorded in `infra/clerk-checklist.md` (ADR 0003).

1. Clerk dashboard → your application → **Development** instance.
2. **Configure → API keys**: copy the **Frontend API URL** (`https://…clerk.accounts.dev`) and run `gh variable set DEV_CLERK_FRONTEND_API_URL`. Terraform registers it with Supabase; do not paste it into Supabase's dashboard.
3. Same page: copy the **Secret key** (`sk_test_…`) and run `gh secret set DEV_CLERK_SECRET_KEY`. The CI checklist check uses it.
4. Same page: copy the **Publishable key** (`pk_test_…`) and run `gh variable set DEV_CLERK_PUBLISHABLE_KEY`. It is public by design and first used by the PWA build.
5. **Integrations → Supabase → Activate**, so tokens carry `role: authenticated`.

For Grafana, also run `gh variable set GRAFANA_STACK_SLUG` with the stack name (the part before `.grafana.net`); Terraform imports that stack instead of creating one.

## 6. Local and cloud-session variables

Only needed when the matching MCP server is added; nothing is needed today. Set them on Windows with:

```powershell
[Environment]::SetEnvironmentVariable('BT_NAME', (Read-Host -AsSecureString 'value' | ConvertFrom-SecureString -AsPlainText), 'User')
```

Then restart VS Code. Add the same names, with the same dev-only values, in the Claude Code cloud environment settings.

- `BT_GITHUB_MCP_TOKEN`: fine-grained PAT, this repo only, read-only (Contents, Issues, Pull requests, Actions, Metadata).
- `BT_GRAFANA_DEV_TOKEN`: Grafana service account token, Viewer role.

The Bruno collection in `bruno/` reads these (dev values only, never production):

- `BT_API_TOKEN`: a personal access token for the API, sent as `Authorization: Bearer`. Available after the tokens endpoint (task 9) ships; until then use the Clerk requests in `bruno/auth-clerk/`.
- `BT_CLERK_SECRET_KEY`: the Clerk dev instance secret key. The three requests in `bruno/auth-clerk/` use it to get a session token for the test user `bt-test-alice` and store it in a runtime variable, which the collection then prefers over `BT_API_TOKEN`.
- `BT_GATEWAY_SECRET`: for the `local` environment only, the `GATEWAY_SECRET` you serve the function with. Leave it unset for `dev`: the Worker adds the header.
- `BT_WORKERS_SUBDOMAIN`: for the `dev` environment, the account's workers.dev subdomain.

## Generated by Terraform (do not set)

| Name | Created by |
| --- | --- |
| `TF_STATE_R2_ACCESS_KEY_ID`, `TF_STATE_R2_SECRET_ACCESS_KEY` | `infra/bootstrap` (bucket-scoped R2 token) |
| `DEV_SUPABASE_URL`, `DEV_SUPABASE_ANON_KEY`, `DEV_SUPABASE_SERVICE_ROLE_KEY`, `DEV_SUPABASE_DB_PASSWORD` | `infra/envs/dev` |
| `GRAFANA_OTLP_ENDPOINT`, `GRAFANA_OTLP_INSTANCE_ID`, `GRAFANA_OTLP_TOKEN` | `infra/envs/dev` |

Phase 3 needs only `DEV_GROQ_API_KEY` (ADR 0007), set as a repo secret; Terraform passes it to Supabase secrets. Embeddings use Supabase's built-in model, so there is no key. A Claude key is added only if no Groq model passes the evals.
