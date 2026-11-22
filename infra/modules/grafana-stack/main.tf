resource "grafana_cloud_stack" "this" {
  provider = grafana.cloud

  name = var.stack_slug
  slug = var.stack_slug

  lifecycle {
    prevent_destroy = true
  }
}

resource "grafana_cloud_access_policy" "otlp_write" {
  provider = grafana.cloud

  region       = grafana_cloud_stack.this.region_slug
  name         = "${var.stack_slug}-otlp-write"
  display_name = "OTLP write"
  scopes       = ["metrics:write", "logs:write", "traces:write"]

  realm {
    type       = "stack"
    identifier = grafana_cloud_stack.this.id
  }
}

resource "grafana_cloud_access_policy_token" "otlp_write" {
  provider = grafana.cloud

  region           = grafana_cloud_stack.this.region_slug
  access_policy_id = grafana_cloud_access_policy.otlp_write.policy_id
  name             = "${var.stack_slug}-otlp-write"
  display_name     = "OTLP write"
}

resource "grafana_cloud_access_policy" "sm_publisher" {
  provider = grafana.cloud

  region       = grafana_cloud_stack.this.region_slug
  name         = "${var.stack_slug}-sm-publisher"
  display_name = "Synthetic Monitoring publisher"
  scopes       = ["metrics:write", "logs:write", "traces:write", "stacks:read"]

  realm {
    type       = "stack"
    identifier = grafana_cloud_stack.this.id
  }
}

resource "grafana_cloud_access_policy_token" "sm_publisher" {
  provider = grafana.cloud

  region           = grafana_cloud_stack.this.region_slug
  access_policy_id = grafana_cloud_access_policy.sm_publisher.policy_id
  name             = "${var.stack_slug}-sm-publisher"
  display_name     = "Synthetic Monitoring publisher"
}

resource "grafana_synthetic_monitoring_installation" "this" {
  provider = grafana.cloud

  stack_id              = grafana_cloud_stack.this.id
  metrics_publisher_key = grafana_cloud_access_policy_token.sm_publisher.token
}

data "grafana_synthetic_monitoring_probes" "main" {
  provider   = grafana.sm
  depends_on = [grafana_synthetic_monitoring_installation.this]
}

resource "grafana_synthetic_monitoring_check" "site" {
  provider = grafana.sm

  job       = "site-${var.env}"
  target    = var.site_url
  enabled   = true
  frequency = var.check_frequency_ms
  timeout   = 10000
  probes    = [for name in var.probe_names : data.grafana_synthetic_monitoring_probes.main.probes[name]]

  labels = {
    env = var.env
  }

  settings {
    http {
      method          = "GET"
      ip_version      = "V4"
      fail_if_not_ssl = true
    }
  }
}

locals {
  secrets = {
    GRAFANA_OTLP_ENDPOINT    = grafana_cloud_stack.this.otlp_url
    GRAFANA_OTLP_INSTANCE_ID = grafana_cloud_stack.this.id
    GRAFANA_OTLP_TOKEN       = grafana_cloud_access_policy_token.otlp_write.token
  }
}

resource "github_actions_secret" "this" {
  for_each = nonsensitive(toset(keys(local.secrets)))

  repository  = var.github_repository
  secret_name = each.key
  value       = local.secrets[each.key]
}

resource "grafana_synthetic_monitoring_check" "api" {
  provider = grafana.sm
  count    = var.api_health_url == "" ? 0 : 1

  job       = "api-${var.env}"
  target    = var.api_health_url
  enabled   = true
  frequency = var.check_frequency_ms
  timeout   = 10000
  probes    = [for name in var.probe_names : data.grafana_synthetic_monitoring_probes.main.probes[name]]

  labels = {
    env = var.env
  }

  settings {
    http {
      method             = "GET"
      ip_version         = "V4"
      fail_if_not_ssl    = true
      valid_status_codes = [200]
    }
  }
}

resource "grafana_frontend_o11y_app" "web" {
  provider = grafana.cloud

  stack_id        = grafana_cloud_stack.this.id
  name            = "web-${var.env}"
  allowed_origins = [var.web_url]

  extra_log_attributes = {
    env = var.env
  }

  settings = {
    "combineLabData"      = "1"
    "geolocation.enabled" = "0"
  }
}
