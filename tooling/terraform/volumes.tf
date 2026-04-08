# ═══════════════════════════════════════════════════════════
# Persistent Volumes
# ═══════════════════════════════════════════════════════════

resource "hcloud_volume" "db_data" {
  name      = "servix-db-data"
  size      = 80 # GB
  server_id = hcloud_server.production.id
  automount = true
  format    = "ext4"

  labels = {
    purpose = "database"
    project = "servix"
  }
}

resource "hcloud_volume" "backup" {
  name      = "servix-backups"
  size      = 40 # GB
  server_id = hcloud_server.production.id
  automount = true
  format    = "ext4"

  labels = {
    purpose = "backups"
    project = "servix"
  }
}
