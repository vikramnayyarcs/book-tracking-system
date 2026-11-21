variable "account_id" {
  description = "Cloudflare account that owns the zone and the Pages projects."
  type        = string
}

variable "domain" {
  description = "Apex domain of the zone, which must already exist in the account."
  type        = string
}

variable "site_pages_project" {
  description = "Name of the Pages project that serves the marketing site."
  type        = string
}

variable "site_pages_subdomain" {
  description = "pages.dev host name of the marketing site project, the target of its DNS records."
  type        = string
}

variable "blocked_paths" {
  description = "Path prefixes that no client should ever ask for; a request whose path starts with one is blocked."
  type        = list(string)
  default     = ["/.env", "/.git", "/wp-admin", "/wp-login.php", "/xmlrpc.php"]
}

variable "rate_limit_requests" {
  description = "Requests one IP may make in the 10-second window before it is blocked."
  type        = number
  default     = 100
}
