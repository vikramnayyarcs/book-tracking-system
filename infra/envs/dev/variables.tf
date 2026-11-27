variable "github_owner" {
  description = "GitHub user or organisation that owns the repository."
  type        = string
}

variable "github_repository" {
  description = "This repository's name."
  type        = string
}

variable "github_app_id" {
  description = "ID of the GitHub App Terraform signs in as (repo variable TF_GITHUB_APP_ID)."
  type        = string
}

variable "github_app_installation_id" {
  description = "Installation ID of that App on this repository (repo variable TF_GITHUB_APP_INSTALLATION_ID)."
  type        = string
}

variable "github_app_private_key" {
  description = "PEM private key of the App (repo secret TF_GITHUB_APP_PRIVATE_KEY)."
  type        = string
  sensitive   = true
}

variable "cloudflare_account_id" {
  description = "Cloudflare account that owns the Pages projects (repo variable CLOUDFLARE_ACCOUNT_ID)."
  type        = string
}

variable "domain" {
  description = "Apex domain of the product. Leave empty until the domain is bought and added to Cloudflare; the zone module stays off while it is empty."
  type        = string
  default     = ""
}

variable "supabase_organization_id" {
  description = "Supabase organization slug (repo variable DEV_SUPABASE_ORG_ID)."
  type        = string
}

variable "clerk_frontend_api_url" {
  description = "Clerk development instance Frontend API URL (repo variable DEV_CLERK_FRONTEND_API_URL). Empty skips registering Clerk with Supabase."
  type        = string
  default     = ""
}

variable "grafana_stack_slug" {
  description = "Slug of the existing Grafana Cloud stack (repo variable GRAFANA_STACK_SLUG)."
  type        = string
}

variable "groq_api_key" {
  description = "Groq API key for the api function (repo secret DEV_GROQ_API_KEY). Empty skips the secret."
  type        = string
  default     = ""
  sensitive   = true
}

variable "clerk_secret_key" {
  description = "Clerk secret key for the api function, which deletes the Clerk user on account deletion (repo secret DEV_CLERK_SECRET_KEY). Empty skips the secret."
  type        = string
  default     = ""
  sensitive   = true
}

variable "workers_subdomain" {
  description = "The account's workers.dev subdomain (repo variable CLOUDFLARE_WORKERS_SUBDOMAIN). Empty skips the API synthetic check."
  type        = string
  default     = ""
}
