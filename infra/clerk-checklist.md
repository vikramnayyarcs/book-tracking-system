# Clerk checklist (development instance)

Clerk has no Terraform provider, so these settings are made by hand in the Clerk dashboard and checked by CI (`scripts/clerk/check.ts`, workflow `clerk-check.yml`). They come from ADR 0003 as amended by ADR 0006. If you change a setting, change this file and `scripts/clerk/expected.ts` in the same PR.

Dashboard: your application → **Development** instance.

## Checked by CI

| Where | Setting | Value |
| --- | --- | --- |
| Configure → User & authentication → Email, phone, username | Email address | On. How it signs in and verifies is left as it is live (ADR 0006); not checked |
| Same page | Phone number, username, password, web3 wallet, passkeys | Off (password was turned off on 2026-11-21) |
| Configure → User & authentication → Social connections | Google and Apple | On (Clerk's shared credentials in development) |
| Same page | Every other social connection | Off |
| API keys | Secret key and Frontend API URL | Dev instance (`sk_test_…`, `…clerk.accounts.dev`) |

## Not checked by CI

Clerk's API does not show these. Check them by hand after any change to the instance.

| Where | Setting | Value |
| --- | --- | --- |
| Integrations → Supabase | Supabase integration | **Activated**, so session tokens carry `role: authenticated` |
| Configure → Sessions | Session token | Includes the `role` claim after activation. Decode one token to confirm |
| Configure → Developers → Paths | Sign-in URL | `/sign-in` (the app's own route, which shows Clerk's `<SignIn />`) |
| Same page | After sign-in | `/` |

## Repo secrets and variables

| Name | Kind | Used by |
| --- | --- | --- |
| `DEV_CLERK_FRONTEND_API_URL` | Variable | Terraform (Supabase third-party auth) and the check |
| `DEV_CLERK_SECRET_KEY` | Secret | The check |
| `DEV_CLERK_PUBLISHABLE_KEY` | Variable | The PWA build, from Phase 4 |

See `docs/secrets.md` section 5 for how to set them.

## Why not `clerk config pull`

The Clerk CLI's `config pull` signs in through Clerk's Platform API (browser login), not with an instance secret key, so it cannot run unattended in CI. The check reads the Backend API with the secret key and the public Frontend API instead.
