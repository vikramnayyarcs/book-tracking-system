module "site_prod" {
  source = "../../modules/cloudflare-pages"

  account_id = var.cloudflare_account_id
  name       = "site-prod"
}

module "zone" {
  count  = var.domain == "" ? 0 : 1
  source = "../../modules/cloudflare-zone"

  domain         = var.domain
  site_hostnames = [var.domain, "www.${var.domain}"]
}

module "site_prod_domain" {
  for_each = var.domain == "" ? toset([]) : toset(["apex", "www"])
  source   = "../../modules/cloudflare-site-domain"

  account_id      = var.cloudflare_account_id
  domain          = var.domain
  hostname        = each.key == "apex" ? var.domain : "www.${var.domain}"
  pages_project   = module.site_prod.name
  pages_subdomain = module.site_prod.subdomain
}

module "supabase_prod" {
  source = "../../modules/supabase-project"

  organization_id        = var.supabase_organization_id
  name                   = "book-tracking-prod"
  github_repository      = var.github_repository
  secret_prefix          = "PROD_"
  clerk_frontend_api_url = var.clerk_frontend_api_url
}
