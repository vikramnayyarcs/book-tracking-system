variable "organization_id" {
  description = "Supabase organization slug that owns the project (repo variable DEV_SUPABASE_ORG_ID)."
  type        = string
}

variable "name" {
  description = "Project name."
  type        = string
}

variable "region" {
  description = "Supabase region code; London is eu-west-2."
  type        = string
  default     = "eu-west-2"
}

variable "github_repository" {
  description = "Repository whose Actions secrets receive the project's connection details."
  type        = string
}

variable "secret_prefix" {
  description = "Prefix for the repo secrets this module writes, for example DEV_."
  type        = string
}

variable "clerk_frontend_api_url" {
  description = "Clerk Frontend API URL (https://....clerk.accounts.dev) that Supabase trusts for sign-in. Empty skips the registration."
  type        = string
  default     = ""
}
