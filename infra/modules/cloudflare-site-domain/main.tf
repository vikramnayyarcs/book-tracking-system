data "cloudflare_zone" "this" {
  filter = {
    name = var.domain
  }
}

resource "cloudflare_pages_domain" "this" {
  account_id   = var.account_id
  project_name = var.pages_project
  name         = var.hostname
}

resource "cloudflare_dns_record" "this" {
  zone_id = data.cloudflare_zone.this.zone_id
  name    = var.hostname
  type    = "CNAME"
  content = var.pages_subdomain
  proxied = true
  ttl     = 1
}
