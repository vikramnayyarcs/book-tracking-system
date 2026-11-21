---
name: infra-change
description: Add or change Terraform in infra/ (a module, a root, a provider or a resource). Use for any change under infra/, so fmt, validate, the lock file and the plan-dev review are never skipped.
---

# Change infrastructure

Infrastructure changes only through Terraform (`CLAUDE.md`). Apply and deploys run only in GitHub Actions: never run `terraform apply`, `terraform destroy` or `wrangler` here. Merging the PR is what applies to dev.

## Steps

1. Read `infra/README.md` and the existing module closest to the change (`infra/modules/github-repo` is the model). Check whether an ADR covers the choice; if not, stop and open a `needs-owner` issue.
2. Look up provider and resource arguments with the Terraform MCP server (`get_provider_details`, `search_provider_docs`) or Context7. Do not guess arguments.
3. Put reusable resources in `infra/modules/<name>/` with `main.tf`, `variables.tf`, `outputs.tf` and `versions.tf`. Each variable has a `description`; secrets are `sensitive = true`. Pin providers to a minor version (`~> X.Y`) and `required_version = "~> 1.17"`.
4. Call the module from `infra/envs/dev` (and later `infra/envs/prod`). Add new provider configuration and its variables to the root's `versions.tf` and `variables.tf`. Pass credentials as `TF_VAR_*` in the workflows, from repo secrets or variables; never write a value in a `.tf` file.
5. Adopt an existing resource with an `import` block; never create a second copy of something that already exists.
6. Run the local checks:

   ```sh
   terraform fmt -recursive infra
   terraform -chdir=infra/envs/dev init -backend=false
   terraform -chdir=infra/envs/dev validate
   ```

7. If a provider or its version changed, refresh the lock file for both platforms in every root that uses it, or CI on Linux rejects it:

   ```sh
   terraform -chdir=infra/envs/dev providers lock -platform=windows_amd64 -platform=linux_amd64
   ```

8. Commit the module, the root wiring and the lock file as separate small commits.
9. Open the PR. CI runs `terraform fmt -check`, `validate` for every root, and `plan-dev`. Read the plan in the job summary and copy the relevant lines into the PR body.
10. Stop and open a `needs-owner` issue if the plan would destroy or replace an existing resource, or if a provider rejects the credentials.

## Never

- Change a Cloudflare, Supabase, GitHub or Grafana setting in a dashboard. If no provider can do it, add a step to `infra/README.md` for the owner (Clerk follows `infra/clerk-checklist.md`).
- Run apply, destroy or a deploy locally.
- Put a secret value in the repo.
- Edit state by hand.

## After merge

`deploy-dev.yml` applies the change. The nightly drift check (`drift.yml`, once it exists) must stay clean; a dashboard edit shows up there as drift.
