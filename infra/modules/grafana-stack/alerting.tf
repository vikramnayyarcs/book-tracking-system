locals {
  alerting_enabled = nonsensitive(var.alert_email != "")

  prom_uid = "grafanacloud-prom"

  m = {
    requests = "api_requests_total"
    duration = "api_request_duration_seconds_bucket"
    ai_cost  = "ai_tokens_total"
    nudge    = "nudge_job_runs_total"
    edge_err = "edge_function_errors_total"
  }

  alerts = {
    api_5xx = {
      title     = "API 5xx rate above 5 percent"
      summary   = "More than 5 percent of API requests failed with a 5xx status for 10 minutes."
      expr      = "sum(rate(${local.m.requests}{env=\"${var.env}\",status_class=\"5xx\"}[5m])) / sum(rate(${local.m.requests}{env=\"${var.env}\"}[5m]))"
      threshold = 0.05
      window    = 900
      for       = "10m"
    }
    api_p95 = {
      title     = "API p95 latency above 2 seconds"
      summary   = "The 95th percentile API latency stayed above 2 seconds for 10 minutes."
      expr      = "histogram_quantile(0.95, sum by (le) (rate(${local.m.duration}{env=\"${var.env}\"}[5m])))"
      threshold = 2
      window    = 900
      for       = "10m"
    }
    ai_usage = {
      title     = "AI usage spike"
      summary   = "AI tokens in the last hour passed ${var.ai_tokens_per_hour_limit}. Check for a runaway loop or abuse (cost guard)."
      expr      = "sum(increase(${local.m.ai_cost}{env=\"${var.env}\"}[1h]))"
      threshold = var.ai_tokens_per_hour_limit
      window    = 3600
      for       = "0s"
    }
    nudge_failure = {
      title     = "Nudge job failed"
      summary   = "The nudge job reported at least one failed run in the last hour."
      expr      = "sum(increase(${local.m.nudge}{env=\"${var.env}\",result=\"failure\"}[1h]))"
      threshold = 0
      window    = 3600
      for       = "0s"
    }
    edge_errors = {
      title     = "Edge Function errors"
      summary   = "Edge Functions threw more than 5 unhandled errors in 10 minutes."
      expr      = "sum(increase(${local.m.edge_err}{env=\"${var.env}\"}[10m]))"
      threshold = 5
      window    = 900
      for       = "0s"
    }
  }
}

resource "grafana_folder" "alerts" {
  provider = grafana.stack
  count    = local.alerting_enabled ? 1 : 0

  title = "Book tracking ${var.env}"
}

resource "grafana_contact_point" "email" {
  provider = grafana.stack
  count    = local.alerting_enabled ? 1 : 0

  name = "owner-email"

  email {
    addresses = [var.alert_email]
  }
}

resource "grafana_notification_policy" "root" {
  provider = grafana.stack
  count    = local.alerting_enabled ? 1 : 0

  contact_point   = grafana_contact_point.email[0].name
  group_by        = ["alertname"]
  group_wait      = "30s"
  group_interval  = "5m"
  repeat_interval = "4h"
}

resource "grafana_rule_group" "api" {
  provider = grafana.stack
  count    = local.alerting_enabled ? 1 : 0

  name             = "api-${var.env}"
  folder_uid       = grafana_folder.alerts[0].uid
  interval_seconds = 60

  dynamic "rule" {
    for_each = local.alerts

    content {
      name           = rule.value.title
      for            = rule.value.for
      condition      = "C"
      no_data_state  = "OK"
      exec_err_state = "OK"

      annotations = {
        summary = rule.value.summary
      }
      labels = {
        env = var.env
      }

      data {
        ref_id         = "A"
        datasource_uid = local.prom_uid
        relative_time_range {
          from = rule.value.window
          to   = 0
        }
        model = jsonencode({
          refId   = "A"
          expr    = rule.value.expr
          instant = true
          range   = false
        })
      }

      data {
        ref_id         = "B"
        datasource_uid = "-100"
        relative_time_range {
          from = rule.value.window
          to   = 0
        }
        model = jsonencode({
          refId      = "B"
          type       = "reduce"
          expression = "A"
          reducer    = "last"
          datasource = { type = "__expr__", uid = "-100" }
        })
      }

      data {
        ref_id         = "C"
        datasource_uid = "-100"
        relative_time_range {
          from = rule.value.window
          to   = 0
        }
        model = jsonencode({
          refId      = "C"
          type       = "threshold"
          expression = "B"
          datasource = { type = "__expr__", uid = "-100" }
          conditions = [{
            evaluator = { type = "gt", params = [rule.value.threshold] }
          }]
        })
      }
    }
  }
}

resource "grafana_dashboard" "overview" {
  provider = grafana.stack
  count    = local.alerting_enabled ? 1 : 0

  folder = grafana_folder.alerts[0].uid

  config_json = jsonencode({
    uid           = "api-overview-${var.env}"
    title         = "API overview ${var.env}"
    schemaVersion = 39
    time          = { from = "now-24h", to = "now" }
    refresh       = "1m"
    panels = [for i, k in keys(local.alerts) : {
      id         = i + 1
      type       = "timeseries"
      title      = local.alerts[k].title
      datasource = { type = "prometheus", uid = local.prom_uid }
      gridPos    = { x = (i % 2) * 12, y = floor(i / 2) * 8, w = 12, h = 8 }
      targets    = [{ refId = "A", expr = local.alerts[k].expr }]
      fieldConfig = {
        defaults = {
          thresholds = {
            mode  = "absolute"
            steps = [{ color = "green", value = null }, { color = "red", value = local.alerts[k].threshold }]
          }
        }
        overrides = []
      }
    }]
  })
}
