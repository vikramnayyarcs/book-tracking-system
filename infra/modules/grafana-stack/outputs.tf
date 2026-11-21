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
