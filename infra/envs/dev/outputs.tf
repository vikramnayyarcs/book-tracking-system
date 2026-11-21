output "site_dev_project" {
  description = "Pages project name that deploy-dev.yml deploys the site to."
  value       = module.site_dev.name
}

output "site_dev_url" {
  description = "pages.dev address of the dev site."
  value       = module.site_dev.url
}

output "supabase_dev_project_ref" {
  description = "Reference ID of the dev Supabase project."
  value       = module.supabase_dev.project_ref
}
