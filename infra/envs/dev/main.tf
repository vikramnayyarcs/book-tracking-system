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

module "site_dev_domain" {
  count  = var.domain == "" ? 0 : 1
  source = "../../modules/cloudflare-site-domain"

  account_id      = var.cloudflare_account_id
  domain          = var.domain
  hostname        = "dev.${var.domain}"
  pages_project   = module.site_dev.name
  pages_subdomain = module.site_dev.subdomain
}

import {
  to = module.supabase_dev.supabase_project.this
  id = "gabddomwxncvuaoykrhc"
}

module "supabase_dev" {
  source = "../../modules/supabase-project"

  organization_id        = var.supabase_organization_id
  name                   = "book-tracking-dev"
  github_repository      = var.github_repository
  secret_prefix          = "DEV_"
  clerk_frontend_api_url = var.clerk_frontend_api_url
}

import {
  to = module.grafana.grafana_cloud_stack.this
  id = var.grafana_stack_slug
}

module "grafana" {
  source = "../../modules/grafana-stack"

  providers = {
    grafana.cloud = grafana.cloud
    grafana.sm    = grafana.sm
  }

  stack_slug        = var.grafana_stack_slug
  github_repository = var.github_repository
  site_url          = module.site_dev.url
  env               = "dev"
  api_health_url    = var.workers_subdomain == "" ? "" : "https://${module.api_gateway.script_name}.${var.workers_subdomain}.workers.dev/v1/health"
}

resource "random_password" "gateway_secret" {
  length  = 48
  special = false
}

module "api_gateway" {
  source = "../../modules/cloudflare-api-gateway"

  account_id     = var.cloudflare_account_id
  name           = "api-gateway-dev"
  upstream_url   = "${module.supabase_dev.url}/functions/v1/api"
  gateway_secret = random_password.gateway_secret.result
}

resource "tls_private_key" "vapid" {
  algorithm   = "ECDSA"
  ecdsa_curve = "P256"
}

resource "supabase_edge_function_secrets" "api" {
  project_ref = module.supabase_dev.project_ref

  secrets = concat(
    [
      { name = "GATEWAY_SECRET", value = random_password.gateway_secret.result },
      { name = "DEFAULT_TIER", value = "plus" },
    ],
    var.clerk_frontend_api_url == "" ? [] : [{ name = "CLERK_ISSUER", value = var.clerk_frontend_api_url }],
    var.groq_api_key == "" ? [] : [{ name = "GROQ_API_KEY", value = var.groq_api_key }],
    [
      { name = "VAPID_PUBLIC_KEY", value = tls_private_key.vapid.public_key_pem },
      { name = "VAPID_PRIVATE_KEY", value = tls_private_key.vapid.private_key_pem },
    ],
    var.domain == "" ? [] : [{ name = "VAPID_SUBJECT", value = "https://${var.domain}" }],
  )
}
