variable "stack_slug" {
  description = "Slug of the existing Grafana Cloud stack, the part before .grafana.net (repo variable GRAFANA_STACK_SLUG). Imported, never created."
  type        = string
}

variable "github_repository" {
  description = "Repository whose Actions secrets receive the OTLP connection details."
  type        = string
}

variable "site_url" {
  description = "Address the synthetic uptime check requests."
  type        = string
}

variable "env" {
  description = "Value of the env label on the uptime check."
  type        = string
}

variable "probe_names" {
  description = "Names of the Synthetic Monitoring probes that run the check."
  type        = list(string)
  default     = ["London", "Frankfurt"]
}

variable "check_frequency_ms" {
  description = "Milliseconds between uptime checks; five minutes keeps usage inside the free tier."
  type        = number
  default     = 300000
}

variable "api_health_url" {
  description = "Address of the API health endpoint for the synthetic check. Empty skips the check."
  type        = string
  default     = ""
}

variable "web_url" {
  description = "Origin of the web app; the only origin the Faro collector accepts telemetry from."
  type        = string
}

variable "alert_email" {
  description = "Address that receives every alert (repo secret GRAFANA_ALERT_EMAIL). Empty skips the contact point, the alert rules and the dashboard."
  type        = string
  default     = ""
  sensitive   = true
}

variable "ai_tokens_per_hour_limit" {
  description = "AI tokens per hour across all users above which the cost-guard alert fires."
  type        = number
  default     = 500000
}
