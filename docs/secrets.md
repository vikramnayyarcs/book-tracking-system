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
| When the GitHub MCP server is added | `BT_GITHUB_MCP_TOKEN` | Env var | Windows user env and cloud session settings |
| When the Grafana MCP server is added | `BT_GRAFANA_DEV_TOKEN` | Env var | Windows user env and cloud session settings |
| At launch only | `PROD_ENABLED` = `true` | Variable | GitHub repo; leave unset until then |

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

## 5. Local and cloud-session variables

Only needed when the matching MCP server is added; nothing is needed today. Set them on Windows with:

```powershell
[Environment]::SetEnvironmentVariable('BT_NAME', (Read-Host -AsSecureString 'value' | ConvertFrom-SecureString -AsPlainText), 'User')
```

Then restart VS Code. Add the same names, with the same dev-only values, in the Claude Code cloud environment settings.

- `BT_GITHUB_MCP_TOKEN`: fine-grained PAT, this repo only, read-only (Contents, Issues, Pull requests, Actions, Metadata).
- `BT_GRAFANA_DEV_TOKEN`: Grafana service account token, Viewer role.

## Generated by Terraform (do not set)

| Name | Created by |
| --- | --- |
| `TF_STATE_R2_ACCESS_KEY_ID`, `TF_STATE_R2_SECRET_ACCESS_KEY` | `infra/bootstrap` (bucket-scoped R2 token) |
| `DEV_SUPABASE_URL`, `DEV_SUPABASE_ANON_KEY`, `DEV_SUPABASE_SERVICE_ROLE_KEY`, `DEV_SUPABASE_DB_PASSWORD` | `infra/envs/dev` |
| `GRAFANA_OTLP_ENDPOINT`, `GRAFANA_OTLP_INSTANCE_ID`, `GRAFANA_OTLP_TOKEN` | `infra/envs/dev` |

Groq, Claude and embeddings keys arrive in Phase 3 and go into Supabase secrets.
