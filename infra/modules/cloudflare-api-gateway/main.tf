resource "cloudflare_workers_script" "this" {
  account_id  = var.account_id
  script_name = var.name

  main_module        = "worker.js"
  content_file       = "${path.module}/worker.js"
  content_sha256     = filesha256("${path.module}/worker.js")
  compatibility_date = "2026-11-01"

  bindings = [
    {
      name = "UPSTREAM_URL"
      type = "plain_text"
      text = var.upstream_url
    },
    {
      name = "GATEWAY_SECRET"
      type = "secret_text"
      text = var.gateway_secret
    },
  ]
}

resource "cloudflare_workers_script_subdomain" "this" {
  account_id  = var.account_id
  script_name = cloudflare_workers_script.this.script_name
  enabled     = true
}
