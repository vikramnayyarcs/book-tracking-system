output "script_name" {
  description = "Worker script name; its address is https://<script_name>.<account workers.dev subdomain>.workers.dev."
  value       = cloudflare_workers_script.this.script_name
}
