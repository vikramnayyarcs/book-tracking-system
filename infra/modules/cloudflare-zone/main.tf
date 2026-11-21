data "cloudflare_zone" "this" {
  filter = {
    name = var.domain
  }
}

locals {
  zone_id = data.cloudflare_zone.this.zone_id
}

resource "cloudflare_ruleset" "custom_rules" {
  zone_id     = local.zone_id
  name        = "Custom WAF rules"
  description = "Managed by Terraform"
  kind        = "zone"
  phase       = "http_request_firewall_custom"

  rules = [
    {
      description = "Block known-bad paths"
      action      = "block"
      enabled     = true
      expression  = "(${join(" or ", [for p in var.blocked_paths : "starts_with(http.request.uri.path, \"${p}\")"])})"
    },
    {
      description = "Block unexpected methods on the site"
      action      = "block"
      enabled     = true
      expression  = "(http.host in {${join(" ", [for h in var.site_hostnames : "\"${h}\""])}} and not http.request.method in {\"GET\" \"HEAD\" \"OPTIONS\"})"
    },
  ]
}

resource "cloudflare_ruleset" "rate_limit" {
  zone_id     = local.zone_id
  name        = "Rate limiting"
  description = "Managed by Terraform"
  kind        = "zone"
  phase       = "http_ratelimit"

  rules = [
    {
      description = "Per-IP rate limit"
      action      = "block"
      enabled     = true
      expression  = "(http.host ne \"\")"
      ratelimit = {
        characteristics     = ["cf.colo.id", "ip.src"]
        period              = 10
        requests_per_period = var.rate_limit_requests
        mitigation_timeout  = 10
      }
    },
  ]
}
