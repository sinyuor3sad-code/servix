# SERVIX Terraform Infrastructure

## Overview

This directory contains the Infrastructure as Code (IaC) for the SERVIX platform.
All infrastructure is managed declaratively via Terraform and versioned in Git (GitOps).

## Architecture

```
Hetzner Cloud (fsn1)
├── servix-prod (cpx31: 4vCPU, 8GB)
│   ├── Docker Compose (blue/green)
│   ├── Nginx (reverse proxy + SSL)
│   ├── PostgreSQL 17 + Read Replica
│   ├── Redis 8 + PgBouncer
│   ├── Prometheus + Grafana + Jaeger
│   └── Vault + Uptime Kuma
├── servix-staging (cpx21: 3vCPU, 4GB)
│   └── (Mirror of production)
├── servix-db-data (80GB SSD Volume)
└── servix-backups (40GB SSD Volume)

CloudFlare
├── api.servi-x.com → prod server (proxied)
├── dashboard.servi-x.com → prod server (proxied)
├── booking.servi-x.com → prod server (proxied)
├── admin.servi-x.com → prod server (proxied)
└── staging.servi-x.com → staging server (DNS only)
```

## Prerequisites

1. Install [Terraform >= 1.7](https://developer.hashicorp.com/terraform/downloads)
2. Hetzner Cloud API token
3. CloudFlare API token with DNS edit permissions

## Quick Start

```bash
# 1. Copy and fill in your values
cp terraform.tfvars.example terraform.tfvars

# 2. Initialize
terraform init

# 3. Preview changes
terraform plan

# 4. Apply (requires confirmation)
terraform apply
```

## Files

| File | Purpose |
|------|---------|
| `main.tf` | Provider configuration + backend |
| `servers.tf` | Hetzner production + staging servers |
| `firewall.tf` | Network security rules |
| `dns.tf` | CloudFlare DNS records |
| `volumes.tf` | Persistent storage |
| `variables.tf` | Input variables |
| `outputs.tf` | Output values (IPs, DNS) |

## GitOps Workflow

Infrastructure changes follow this workflow:

1. Create a branch and modify `.tf` files
2. Open a Pull Request → CI runs `terraform plan`
3. Review the plan output in the PR
4. Merge to `main` → CI runs `terraform apply`

## Security

- **Never commit** `terraform.tfvars` or `terraform.tfstate` to Git
- Both are in `.gitignore`
- Sensitive variables are marked with `sensitive = true`
- SSH access is restricted to the deploy machine IP
- Monitoring ports (Grafana, Jaeger) are restricted to deploy IP
