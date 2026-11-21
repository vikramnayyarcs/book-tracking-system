output "site_prod_project" {
  description = "Pages project name that release-prod.yml deploys the site to."
  value       = module.site_prod.name
}

output "site_prod_url" {
  description = "pages.dev address of the production site."
  value       = module.site_prod.url
}

output "supabase_prod_project_ref" {
  description = "Reference ID of the production Supabase project."
  value       = module.supabase_prod.project_ref
}
