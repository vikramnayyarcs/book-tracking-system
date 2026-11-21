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
