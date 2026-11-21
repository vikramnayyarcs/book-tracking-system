terraform {
  required_version = "~> 1.17"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.29"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.7"
    }
    supabase = {
      source  = "supabase/supabase"
      version = "~> 1.11"
    }
    github = {
      source  = "integrations/github"
      version = "~> 6.13"
    }
  }

  backend "s3" {
    bucket = "tfstate"
    key    = "prod/terraform.tfstate"
  }
}

provider "cloudflare" {}

provider "supabase" {}

provider "github" {
  owner = var.github_owner
  app_auth {
    id              = var.github_app_id
    installation_id = var.github_app_installation_id
    pem_file        = var.github_app_private_key
  }
}
