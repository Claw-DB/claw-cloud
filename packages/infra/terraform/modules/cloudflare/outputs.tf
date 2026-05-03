output "app_record" {
  value = cloudflare_record.app.hostname
}

output "api_record" {
  value = cloudflare_record.api.hostname
}
