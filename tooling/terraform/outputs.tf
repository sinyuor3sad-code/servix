# ═══════════════════════════════════════════════════════════
# Outputs
# ═══════════════════════════════════════════════════════════

output "production_ip" {
  description = "Production server public IP"
  value       = hcloud_server.production.ipv4_address
}

output "staging_ip" {
  description = "Staging server public IP"
  value       = hcloud_server.staging.ipv4_address
}

output "dr_failover_ip" {
  description = "DR failover server public IP (nbg1)"
  value       = hcloud_server.dr_failover.ipv4_address
}

output "db_volume_path" {
  description = "Database volume mount path"
  value       = hcloud_volume.db_data.linux_device
}

output "dns_records" {
  description = "DNS records created"
  value = {
    api       = "api.${var.cloudflare_zone_id}"
    dashboard = "dashboard.${var.cloudflare_zone_id}"
    booking   = "booking.${var.cloudflare_zone_id}"
    admin     = "admin.${var.cloudflare_zone_id}"
    staging   = "staging.${var.cloudflare_zone_id}"
  }
}
