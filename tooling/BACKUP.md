# SERVIX Backup & Disaster Recovery

Multi-tier strategy following the **3-2-1 rule** with continuous WAL
archiving for low-RPO recovery. This doc is an on-call runbook — read
it before you need it.

## Targets

| Metric | Target | Mechanism                                                     |
| ------ | ------ | ------------------------------------------------------------- |
| RPO    | ≤ 60 s | WAL archiving (`archive_timeout = 60`)                        |
| RTO    | ≤ 30 min (PITR) / ≤ 10 min (logical) | Base backup + WAL replay     |
| Backup retention | 7d local, 30d off-site (immutable) | MinIO + off-site bucket |
| Verification cadence | weekly (on-server) + daily (off-site via CI) | cron + GH Action |

## Storage tiers

```
┌───────────────────────────────────┐
│ Postgres (primary)                │ ← live data
└──────────────┬────────────────────┘
               │ WAL stream (every 60s, encrypted)
               ▼
┌───────────────────────────────────┐
│ MinIO bucket: servix-wal          │ ← PITR replay log
│ MinIO bucket: servix-backups      │ ← logical dumps every 6h
│ MinIO bucket: servix-base-backups │ ← physical base, weekly
└──────────────┬────────────────────┘
               │ daily 02:00 UTC mirror
               ▼
┌───────────────────────────────────┐
│ Off-site S3 (Backblaze/Wasabi/AWS)│ ← survives total VM loss
│  bucket versioning + 30d object   │   immutable for 30 days
│  lock (ransomware-proof)          │
└───────────────────────────────────┘
```

All dumps and WAL segments are encrypted with **AES-256 (GPG symmetric)**
using `BACKUP_ENCRYPTION_PASSPHRASE`. Without that key, the off-site
copies are useless — store the key in **two** places:

1. Secure password manager (1Password / Bitwarden) accessible to two engineers
2. Sealed envelope in physical safe (PDPL audit trail)

## Schedule

| When             | What                          | Script                                      |
| ---------------- | ----------------------------- | ------------------------------------------- |
| every 60 s       | WAL segment forced + archived | `tooling/postgres/archive-wal.sh` (postgres) |
| every 6 h        | logical pg_dump per DB        | `tooling/docker/scripts/backup.sh`          |
| daily 02:00 UTC  | mirror today → off-site       | `tooling/scripts/mirror-to-offsite.sh`      |
| daily 03:00 UTC  | off-site restore-test (CI)    | `.github/workflows/backup.yml`              |
| Sun 04:00 UTC    | local restore-test            | `tooling/scripts/verify-backup.sh`          |
| Sun 05:00 UTC    | physical base backup          | `tooling/scripts/base-backup.sh`            |

## Required env vars (`tooling/docker/.env.prod`)

```bash
# REQUIRED — backup container refuses to start without this.
BACKUP_ENCRYPTION_PASSPHRASE=<32+ chars; rotate annually>

# Off-site mirror (set up a Backblaze B2 / Wasabi / AWS S3 bucket first).
OFFSITE_S3_ENDPOINT=https://s3.us-west-002.backblazeb2.com
OFFSITE_S3_BUCKET=servix-backups-offsite
OFFSITE_S3_ACCESS_KEY=...
OFFSITE_S3_SECRET_KEY=...
OFFSITE_S3_REGION=us-west-002
```

Required GitHub secrets (for the daily restore-test Action):

```
OFFSITE_S3_ENDPOINT
OFFSITE_S3_BUCKET
OFFSITE_S3_ACCESS_KEY
OFFSITE_S3_SECRET_KEY
BACKUP_ENCRYPTION_PASSPHRASE
SLACK_DEPLOY_WEBHOOK_URL
```

## Monitoring

Prometheus alerts in `tooling/prometheus/alerts/backup-alerts.yml`:

| Alert                       | Severity | Fires when                                      |
| --------------------------- | -------- | ----------------------------------------------- |
| `BackupStale`               | P1       | No successful logical dump in 25h               |
| `BackupNeverRan`            | P1       | Metric absent (container down / mount broken)   |
| `BackupPartialFailure`      | P2       | One or more DBs failed in last run              |
| `OffsiteMirrorStale`        | P1       | No mirror in 49h — single VM loss = total loss  |
| `OffsiteMirrorNotConfigured`| P2       | Mirror never run — env not set                  |
| `BackupVerifyFailed`        | P1       | Last weekly restore-test failed                 |
| `BackupVerifyStale`         | P2       | No verify pass in 14 days                       |
| `BackupVolumeAlmostFull`    | P2       | `/backups` < 20 % free                          |

Metrics live at `${METRICS_DIR}/servix_backup*.prom`, scraped via
node-exporter's textfile collector.

## Recovery runbooks

### A. Restore one tenant DB from yesterday's logical backup (RTO ~5 min)

```bash
ssh root@130.94.57.77
docker exec -it servix-backup sh
mc ls servix/servix-backups/ | tail -5         # find the right folder
/scripts/restore.sh 20260415_180000 servix_tenant_abc123
# script prompts y/N before overwriting
```

If the on-server MinIO is unavailable (server lost), restore from off-site
via the same script — it falls back to the off-site alias automatically
once the bucket is configured.

### B. Restore everything from off-site (server loss / DR exercise)

```bash
# On a fresh VM with Docker installed:
git clone https://github.com/sinyuor3sad-code/servix.git
cd servix
cp tooling/docker/.env.prod.example tooling/docker/.env.prod
# Fill in BACKUP_ENCRYPTION_PASSPHRASE + OFFSITE_S3_* from password manager.

docker compose -f tooling/docker/docker-compose.prod.yml up -d postgres minio backup
sleep 30

# Pull from off-site → restore all DBs.
docker exec servix-backup sh -c '
  mc alias set offsite "$OFFSITE_S3_ENDPOINT" "$OFFSITE_S3_ACCESS_KEY" "$OFFSITE_S3_SECRET_KEY" --api S3v4
  LATEST=$(mc ls offsite/$OFFSITE_S3_BUCKET/ | awk "{print \$NF}" | tr -d "/" | sort | tail -1)
  mc cp --recursive offsite/$OFFSITE_S3_BUCKET/$LATEST/ /backups/dr/
  for f in /backups/dr/*.sql.gz.gpg; do
    DB=$(basename "$f" .sql.gz.gpg)
    psql -h postgres -U servix -d postgres -c "CREATE DATABASE \"$DB\";"
    gpg --batch --decrypt --passphrase "$BACKUP_ENCRYPTION_PASSPHRASE" "$f" \
      | gunzip -c \
      | psql -h postgres -U servix -d "$DB"
  done
'
```

### C. Point-in-time recovery (data corruption at known timestamp)

PITR replays WAL on top of a base backup until the target timestamp.
Use this when a bad migration / accidental DROP happened at `T`.

```bash
# 1. Pick a base backup taken BEFORE the incident.
docker exec servix-backup mc ls servix/servix-base-backups/

# 2. Stop the running postgres.
docker compose -f tooling/docker/docker-compose.prod.yml stop postgres

# 3. Move the corrupt data dir aside.
docker run --rm -v servix_postgres_data:/data alpine \
  sh -c 'mv /data/* /data/.broken/ 2>/dev/null || true; mkdir -p /data/.broken'

# 4. Extract base backup into the data dir.
BASE=20260414T050000Z
docker run --rm -v servix_postgres_data:/data \
  -v $(pwd)/restore:/restore \
  -e PASSPHRASE="$BACKUP_ENCRYPTION_PASSPHRASE" \
  alpine sh -c '
    apk add --no-cache gnupg
    for f in /restore/*.tar.gz.gpg; do
      gpg --batch --decrypt --passphrase "$PASSPHRASE" "$f" \
        | tar xzf - -C /data
    done
  '

# 5. Create recovery.signal + restore_command + recovery_target_time.
docker run --rm -v servix_postgres_data:/data alpine sh -c '
  touch /data/recovery.signal
  cat >> /data/postgresql.auto.conf <<EOF
restore_command = "/scripts/restore-wal.sh %f %p"
recovery_target_time = "2026-04-15 14:23:00 UTC"
recovery_target_action = "promote"
EOF
'

# 6. Start postgres — it will replay WAL and stop at the target time.
docker compose -f tooling/docker/docker-compose.prod.yml up -d postgres
docker logs -f servix-postgres   # watch for "recovery stopping before commit"
```

A `restore-wal.sh` companion to `archive-wal.sh` is intentionally not
shipped — write it ad-hoc during the incident to fetch from
`servix-wal` / off-site, since the layout is simple and the URL/bucket
will vary by where you're recovering.

## Rotation procedures

### Encryption passphrase

Rotate annually (or immediately on suspected compromise):

1. Generate new passphrase.
2. Decrypt one full backup with the OLD passphrase + re-encrypt with NEW.
3. Update `BACKUP_ENCRYPTION_PASSPHRASE` in `.env.prod` + GitHub secret.
4. Restart the backup container — the next cron run will use the new key.
5. Old backups remain readable with the old passphrase; archive both keys
   for the duration of the legal retention window (PDPL: 5 years for
   financial records).

### Off-site bucket access keys

Rotate quarterly. Generate new keys in the off-site provider's console,
update `.env.prod` + GitHub secret, restart the backup container, then
revoke the old keys.

## Adding a new database

The backup script auto-discovers all non-template Postgres databases —
no code change needed when a new tenant DB is created. Verify on the
next cron run that the new DB appears in `mc ls servix/servix-backups/`.

## What NOT to do

- ❌ Don't run `pg_dump` against production from a public CI runner. The
  DB is private behind PgBouncer and should stay that way.
- ❌ Don't store the encryption passphrase in the same place as the
  off-site bucket credentials. Compromising one shouldn't grant access
  to readable backups.
- ❌ Don't shorten `archive_timeout` below 30 s — it forces a WAL
  segment switch even on idle DBs, generating churn and wasting
  off-site bandwidth.
- ❌ Don't disable backups during long-running migrations. Take an
  ad-hoc backup BEFORE: `docker exec servix-backup /bin/sh /scripts/backup.sh`.
