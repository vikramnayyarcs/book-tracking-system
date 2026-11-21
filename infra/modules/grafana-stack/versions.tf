terraform {
  required_version = "~> 1.17"

  required_providers {
    grafana = {
      source                = "grafana/grafana"
      version               = "~> 4.55"
      configuration_aliases = [grafana.cloud, grafana.sm]
    }
    github = {
      source  = "integrations/github"
      version = "~> 6.13"
    }
  }
}
