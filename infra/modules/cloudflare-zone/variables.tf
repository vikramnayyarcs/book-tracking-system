variable "domain" {
  description = "Apex domain of the zone, which must already exist in the account."
  type        = string
}

variable "site_hostnames" {
  description = "Host names of the marketing site. The method rule applies only to these, so other hosts such as a future api subdomain are unaffected."
  type        = list(string)
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
