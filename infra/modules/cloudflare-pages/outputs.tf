output "name" {
  description = "Pages project name, as passed to wrangler pages deploy."
  value       = cloudflare_pages_project.this.name
}

output "url" {
  description = "Address of the project on pages.dev."
  value       = "https://${cloudflare_pages_project.this.subdomain}"
}

output "subdomain" {
  description = "pages.dev host name of the project."
  value       = cloudflare_pages_project.this.subdomain
}
