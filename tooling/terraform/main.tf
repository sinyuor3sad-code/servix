# ═══════════════════════════════════════════════════════════
# SERVIX — Terraform Infrastructure as Code
# ═══════════════════════════════════════════════════════════
# Manages: Hetzner Cloud servers, CloudFlare DNS, Firewall, Volumes
# ═══════════════════════════════════════════════════════════

terraform {
  required_version = ">= 1.7"

  required_providers {
    hcloud = {
      source  = "hetznercloud/hcloud"
      version = "~> 1.45"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }

  backend "local" {
    path = "terraform.tfstate"
  }
}

# ── Providers ──────────────────────────────────────────────

provider "hcloud" {
  token = var.hcloud_token
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}
