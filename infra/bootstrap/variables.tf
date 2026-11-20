variable "cloudflare_account_id" {
  description = "Cloudflare account that owns the state bucket."
  type        = string
}

variable "github_owner" {
  description = "GitHub user or organisation that owns the repository."
  type        = string
}

variable "github_repository" {
  description = "Repository whose Actions secrets receive the state credentials."
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

variable "state_bucket_name" {
  description = "R2 bucket for Terraform state. Must match the bucket in every backend block."
  type        = string
  default     = "tfstate"
}

variable "state_bucket_location" {
  description = "R2 location hint for the state bucket."
  type        = string
  default     = "weur"
}
