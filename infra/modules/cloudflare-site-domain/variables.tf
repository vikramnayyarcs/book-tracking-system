variable "account_id" {
  description = "Cloudflare account that owns the zone and the Pages project."
  type        = string
}

variable "domain" {
  description = "Apex domain of the zone, which must already exist in the account."
  type        = string
}

variable "hostname" {
  description = "Full host name to serve, for example www.example.com or dev.example.com."
  type        = string
}

variable "pages_project" {
  description = "Name of the Pages project that serves this host name."
  type        = string
}

variable "pages_subdomain" {
  description = "pages.dev host name of the Pages project, the target of the DNS record."
  type        = string
}
