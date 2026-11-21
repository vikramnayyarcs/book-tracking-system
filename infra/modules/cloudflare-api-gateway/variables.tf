variable "account_id" {
  description = "Cloudflare account that owns the Worker (repo variable CLOUDFLARE_ACCOUNT_ID)."
  type        = string
}

variable "name" {
  description = "Worker script name, for example api-gateway-dev."
  type        = string
}

variable "upstream_url" {
  description = "Address of the api Edge Function, without a trailing slash."
  type        = string
}

variable "gateway_secret" {
  description = "Shared secret the Worker adds to every request in the x-gateway-secret header."
  type        = string
  sensitive   = true
}
