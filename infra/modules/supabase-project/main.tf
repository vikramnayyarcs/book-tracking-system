resource "random_password" "database" {
  length  = 32
  special = false
}

resource "supabase_project" "this" {
  organization_id   = var.organization_id
  name              = var.name
  region            = var.region
  database_password = random_password.database.result

  lifecycle {
    prevent_destroy = true
    ignore_changes  = [database_password]
  }
}

data "supabase_apikeys" "this" {
  project_ref = supabase_project.this.id
}

resource "supabase_third_party_auth" "clerk" {
  count = var.clerk_frontend_api_url == "" ? 0 : 1

  project_ref     = supabase_project.this.id
  oidc_issuer_url = var.clerk_frontend_api_url
}

locals {
  secrets = {
    "${var.secret_prefix}SUPABASE_PROJECT_REF"      = supabase_project.this.id
    "${var.secret_prefix}SUPABASE_URL"              = "https://${supabase_project.this.id}.supabase.co"
    "${var.secret_prefix}SUPABASE_DB_PASSWORD"      = random_password.database.result
    "${var.secret_prefix}SUPABASE_ANON_KEY"         = data.supabase_apikeys.this.anon_key
    "${var.secret_prefix}SUPABASE_SERVICE_ROLE_KEY" = data.supabase_apikeys.this.service_role_key
  }
}

resource "github_actions_secret" "this" {
  for_each = nonsensitive(toset(keys(local.secrets)))

  repository  = var.github_repository
  secret_name = each.key
  value       = local.secrets[each.key]
}
