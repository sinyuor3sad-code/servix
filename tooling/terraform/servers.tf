# ═══════════════════════════════════════════════════════════
# Hetzner Cloud Servers
# ═══════════════════════════════════════════════════════════

resource "hcloud_ssh_key" "deploy" {
  name       = "servix-deploy"
  public_key = var.ssh_public_key
}

# ── Production Server ──────────────────────────────────────

resource "hcloud_server" "production" {
  name        = "servix-prod"
  server_type = "cpx31" # 4 vCPU, 8GB RAM
  image       = "ubuntu-22.04"
  location    = "fsn1"
  ssh_keys    = [hcloud_ssh_key.deploy.id]
  firewall_ids = [hcloud_firewall.web.id]

  labels = {
    environment = "production"
    project     = "servix"
    managed_by  = "terraform"
  }

  user_data = <<-EOF
    #!/bin/bash
    apt-get update && apt-get install -y docker.io docker-compose-v2 fail2ban ufw
    systemctl enable docker
    ufw allow OpenSSH
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw --force enable
  EOF
}

# ── Staging Server ─────────────────────────────────────────

resource "hcloud_server" "staging" {
  name        = "servix-staging"
  server_type = "cpx21" # 3 vCPU, 4GB RAM
  image       = "ubuntu-22.04"
  location    = "fsn1"
  ssh_keys    = [hcloud_ssh_key.deploy.id]
  firewall_ids = [hcloud_firewall.web.id]

  labels = {
    environment = "staging"
    project     = "servix"
    managed_by  = "terraform"
  }

  user_data = <<-EOF
    #!/bin/bash
    apt-get update && apt-get install -y docker.io docker-compose-v2 fail2ban ufw
    systemctl enable docker
    ufw allow OpenSSH
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw --force enable
  EOF
}

# ── DR Failover Server (different datacenter) ─────────────

resource "hcloud_server" "dr_failover" {
  name        = "servix-dr"
  server_type = "cpx31"       # Same as production
  image       = "ubuntu-22.04"
  location    = "nbg1"        # Nuremberg (different from fsn1 Frankfurt)
  ssh_keys    = [hcloud_ssh_key.deploy.id]
  firewall_ids = [hcloud_firewall.web.id]

  labels = {
    environment = "dr-failover"
    project     = "servix"
    managed_by  = "terraform"
  }

  user_data = <<-EOF
    #!/bin/bash
    apt-get update && apt-get install -y docker.io docker-compose-v2 fail2ban ufw
    systemctl enable docker
    ufw allow OpenSSH
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw --force enable
  EOF
}
