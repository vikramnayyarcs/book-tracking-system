resource "grafana_cloud_stack_service_account" "terraform" {
  provider = grafana.cloud

  stack_slug = grafana_cloud_stack.this.slug
  name       = "terraform-alerting"
  role       = "Admin"
}

resource "grafana_cloud_stack_service_account_token" "terraform" {
  provider = grafana.cloud

  stack_slug         = grafana_cloud_stack.this.slug
  service_account_id = grafana_cloud_stack_service_account.terraform.id
  name               = "terraform-alerting"
}
