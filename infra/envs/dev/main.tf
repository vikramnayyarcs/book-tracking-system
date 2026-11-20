import {
  to = module.github_repo.github_repository.this
  id = var.github_repository
}

module "github_repo" {
  source = "../../modules/github-repo"

  name        = var.github_repository
  description = "Private, AI-powered memory for the physical books you read."
}
