variable "name" {
  description = "Repository name."
  type        = string
}

variable "description" {
  description = "Repository description shown on GitHub."
  type        = string
  default     = ""
}

variable "homepage_url" {
  description = "Website link shown in the repository's About box; the deployed dev site, so it can be opened from the repo page."
  type        = string
  default     = ""
}

variable "allowed_action_patterns" {
  description = "Third-party actions allowed besides GitHub-owned ones. Every action must also be pinned to a commit SHA."
  type        = list(string)
  default     = ["hashicorp/setup-terraform@*"]
}
