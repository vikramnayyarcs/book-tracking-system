output "stack_url" {
  description = "Address of the Grafana instance."
  value       = "https://${var.stack_slug}.grafana.net"
}

output "sm_access_token" {
  description = "Token for the Synthetic Monitoring API, used to configure the sm provider."
  value       = grafana_synthetic_monitoring_installation.this.sm_access_token
  sensitive   = true
}

output "sm_url" {
  description = "Synthetic Monitoring API address for the stack's region."
  value       = grafana_synthetic_monitoring_installation.this.stack_sm_api_url
}

output "faro_collector_url" {
  description = "Grafana Faro collector address the web app sends telemetry to."
  value       = grafana_frontend_o11y_app.web.collector_endpoint
}

output "stack_service_account_token" {
  description = "Token for the stack own Grafana API, used to configure the stack provider."
  value       = grafana_cloud_stack_service_account_token.terraform.key
  sensitive   = true
}
