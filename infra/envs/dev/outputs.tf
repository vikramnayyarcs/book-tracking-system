output "site_dev_project" {
  description = "Pages project name that deploy-dev.yml deploys the site to."
  value       = module.site_dev.name
}

output "site_dev_url" {
  description = "pages.dev address of the dev site."
  value       = module.site_dev.url
}

output "web_dev_project" {
  description = "Pages project name that deploy-dev.yml deploys the web app to."
  value       = module.web_dev.name
}

output "web_dev_url" {
  description = "pages.dev address of the dev web app."
  value       = module.web_dev.url
}

output "faro_collector_url" {
  description = "Grafana Faro collector address; deploy-dev.yml passes it to the web build as VITE_FARO_COLLECTOR_URL."
  value       = module.grafana.faro_collector_url
}

output "api_gateway_url" {
  description = "workers.dev address of the dev API gateway; deploy-dev.yml passes it to the web build as VITE_API_BASE_URL. Empty until workers_subdomain is set."
  value       = var.workers_subdomain == "" ? "" : "https://${module.api_gateway.script_name}.${var.workers_subdomain}.workers.dev"
}

output "supabase_dev_project_ref" {
  description = "Reference ID of the dev Supabase project."
  value       = module.supabase_dev.project_ref
}

output "grafana_stack_url" {
  description = "Address of the shared Grafana Cloud stack."
  value       = module.grafana.stack_url
}

output "jobs_url" {
  description = "Base address of the api function. pg_cron jobs call it directly, not through the gateway. deploy-dev.yml writes it to Vault."
  value       = "${module.supabase_dev.url}/functions/v1/api"
}

output "jobs_secret" {
  description = "Secret for the internal jobs route. The same value is the Edge Function secret JOBS_SECRET; deploy-dev.yml writes it to Vault."
  value       = random_password.jobs_secret.result
  sensitive   = true
}
