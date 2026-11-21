import {
  to = module.github_repo.github_repository.this
  id = var.github_repository
}

module "github_repo" {
  source = "../../modules/github-repo"

  name         = var.github_repository
  description  = "Private, AI-powered memory for the physical books you read."
  homepage_url = module.site_dev.url
}

module "site_dev" {
  source = "../../modules/cloudflare-pages"

  account_id = var.cloudflare_account_id
  name       = "site-dev"
}

module "zone" {
  count  = var.domain == "" ? 0 : 1
  source = "../../modules/cloudflare-zone"

  account_id           = var.cloudflare_account_id
  domain               = var.domain
  site_pages_project   = module.site_dev.name
  site_pages_subdomain = module.site_dev.subdomain
}

module "supabase_dev" {
  source = "../../modules/supabase-project"

  organization_id        = var.supabase_organization_id
  name                   = "book-tracking-dev"
  github_repository      = var.github_repository
  secret_prefix          = "DEV_"
  clerk_frontend_api_url = var.clerk_frontend_api_url
}
