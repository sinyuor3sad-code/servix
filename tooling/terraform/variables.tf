# ═══════════════════════════════════════════════════════════
# Input Variables
# ═══════════════════════════════════════════════════════════

variable "hcloud_token" {
  description = "Hetzner Cloud API token"
  type        = string
  sensitive   = true
}

variable "cloudflare_api_token" {
  description = "CloudFlare API token with DNS edit permissions"
  type        = string
  sensitive   = true
}

variable "cloudflare_zone_id" {
  description = "CloudFlare zone ID for servi-x.com"
  type        = string
}

variable "ssh_public_key" {
  description = "SSH public key for server access"
  type        = string
}

variable "deploy_ip" {
  description = "CIDR of deploy machine for SSH and monitoring access (e.g. 1.2.3.4/32). Required — supply via TF_VAR_deploy_ip or tfvars. V-27: open-world ranges are rejected."
  type        = string

  validation {
    condition     = can(cidrhost(var.deploy_ip, 0)) && var.deploy_ip != "0.0.0.0/0" && var.deploy_ip != "::/0"
    error_message = "deploy_ip must be a specific CIDR like 1.2.3.4/32. Open ranges (0.0.0.0/0, ::/0) are forbidden — they would expose SSH/Grafana/Jaeger to the public internet."
  }
}
