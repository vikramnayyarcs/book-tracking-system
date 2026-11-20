output "state_bucket" {
  value = cloudflare_r2_bucket.state.name
}

output "state_access_key_id" {
  value     = local.state_access_key_id
  sensitive = true
}

output "state_secret_access_key" {
  value     = local.state_secret_access_key
  sensitive = true
}
