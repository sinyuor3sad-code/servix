# ═══════════════════════════════════════════════════════════
# Hetzner Cloud Firewall
# ═══════════════════════════════════════════════════════════

resource "hcloud_firewall" "web" {
  name = "servix-firewall"

  # SSH — restricted to deploy IP
  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "22"
    source_ips = [var.deploy_ip]
    description = "SSH from deploy machine"
  }

  # HTTP
  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "80"
    source_ips = ["0.0.0.0/0", "::/0"]
    description = "HTTP (redirects to HTTPS)"
  }

  # HTTPS
  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "443"
    source_ips = ["0.0.0.0/0", "::/0"]
    description = "HTTPS"
  }

  # Grafana (internal only)
  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "3001"
    source_ips = [var.deploy_ip]
    description = "Grafana dashboard"
  }

  # Jaeger UI (internal only)
  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "16686"
    source_ips = [var.deploy_ip]
    description = "Jaeger tracing UI"
  }
}
