# ═══════════════════════════════════════════════════════════
# CloudFlare DNS Records
# ═══════════════════════════════════════════════════════════

resource "cloudflare_record" "api" {
  zone_id = var.cloudflare_zone_id
  name    = "api"
  content = hcloud_server.production.ipv4_address
  type    = "A"
  proxied = true
  ttl     = 1 # Auto when proxied
}

resource "cloudflare_record" "dashboard" {
  zone_id = var.cloudflare_zone_id
  name    = "dashboard"
  content = hcloud_server.production.ipv4_address
  type    = "A"
  proxied = true
  ttl     = 1
}

resource "cloudflare_record" "booking" {
  zone_id = var.cloudflare_zone_id
  name    = "booking"
  content = hcloud_server.production.ipv4_address
  type    = "A"
  proxied = true
  ttl     = 1
}

resource "cloudflare_record" "admin" {
  zone_id = var.cloudflare_zone_id
  name    = "admin"
  content = hcloud_server.production.ipv4_address
  type    = "A"
  proxied = true
  ttl     = 1
}

resource "cloudflare_record" "landing" {
  zone_id = var.cloudflare_zone_id
  name    = "@"
  content = hcloud_server.production.ipv4_address
  type    = "A"
  proxied = true
  ttl     = 1
}

# Staging DNS (not proxied — internal only)
resource "cloudflare_record" "staging" {
  zone_id = var.cloudflare_zone_id
  name    = "staging"
  content = hcloud_server.staging.ipv4_address
  type    = "A"
  proxied = false
  ttl     = 300
}
