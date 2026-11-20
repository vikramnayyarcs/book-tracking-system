resource "cloudflare_r2_bucket" "state" {
  account_id = var.cloudflare_account_id
  name       = var.state_bucket_name
  location   = var.state_bucket_location

  lifecycle {
    prevent_destroy = true
  }
}

locals {
  r2_object_write_group = "Workers R2 Storage Bucket Item Write"
}

data "cloudflare_account_api_token_permission_groups_list" "r2_object_write" {
  account_id = var.cloudflare_account_id
  name       = urlencode(local.r2_object_write_group)
}

locals {
  r2_object_write_ids = [
    for group in data.cloudflare_account_api_token_permission_groups_list.r2_object_write.result :
    group.id if group.name == local.r2_object_write_group
  ]
}

resource "cloudflare_account_token" "state" {
  account_id = var.cloudflare_account_id
  name       = "terraform-state-${var.state_bucket_name}"

  policies = [{
    effect            = "allow"
    permission_groups = [for id in local.r2_object_write_ids : { id = id }]
    resources = jsonencode({
      "com.cloudflare.edge.r2.bucket.${var.cloudflare_account_id}_default_${cloudflare_r2_bucket.state.name}" = "*"
    })
  }]

  lifecycle {
    precondition {
      condition     = length(local.r2_object_write_ids) == 1
      error_message = "Expected exactly one Cloudflare permission group named \"${local.r2_object_write_group}\"; check its current name."
    }
  }
}

locals {
  state_access_key_id     = cloudflare_account_token.state.id
  state_secret_access_key = sha256(cloudflare_account_token.state.value)
}

resource "github_actions_secret" "state_access_key_id" {
  repository  = var.github_repository
  secret_name = "TF_STATE_R2_ACCESS_KEY_ID"
  value       = local.state_access_key_id
}

resource "github_actions_secret" "state_secret_access_key" {
  repository  = var.github_repository
  secret_name = "TF_STATE_R2_SECRET_ACCESS_KEY"
  value       = local.state_secret_access_key
}
