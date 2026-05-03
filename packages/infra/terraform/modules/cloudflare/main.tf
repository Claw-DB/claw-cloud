resource "cloudflare_record" "app" {
  zone_id = var.zone_id
  name    = var.app_hostname
  type    = "CNAME"
  content = var.app_origin
  proxied = true
}

resource "cloudflare_record" "api" {
  zone_id = var.zone_id
  name    = var.api_hostname
  type    = "CNAME"
  content = var.api_origin
  proxied = true
}
