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
  description = "IP address of deploy machine (for SSH and monitoring access)"
  type        = string
  default     = "0.0.0.0/0" # Override in tfvars for production
}
