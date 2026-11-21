variable "account_id" {
  description = "Cloudflare account that owns the Pages project."
  type        = string
}

variable "name" {
  description = "Pages project name; also the first part of its pages.dev address."
  type        = string
}

variable "production_branch" {
  description = "Branch name Cloudflare treats as production for direct uploads."
  type        = string
  default     = "main"
}
