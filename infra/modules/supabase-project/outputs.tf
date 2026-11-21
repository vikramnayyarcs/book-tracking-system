output "project_ref" {
  description = "Project reference ID."
  value       = supabase_project.this.id
}

output "url" {
  description = "Project API address; the Data API is not used (ADR 0003)."
  value       = "https://${supabase_project.this.id}.supabase.co"
}
