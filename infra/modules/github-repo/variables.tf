variable "name" {
  description = "Repository name."
  type        = string
}

variable "description" {
  description = "Repository description shown on GitHub."
  type        = string
  default     = ""
}

variable "allowed_action_patterns" {
  description = "Third-party actions allowed besides GitHub-owned ones. Every action must also be pinned to a commit SHA."
  type        = list(string)
  default     = ["hashicorp/setup-terraform@*"]
}
