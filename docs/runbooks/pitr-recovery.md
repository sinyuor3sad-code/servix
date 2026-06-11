# PITR Recovery Runbook (A8-IV-019b/c)

Restores a `servix_platform` database (or any tenant DB) to a point in time, using:

- The encrypted base backup in MinIO bucket `servix-base-backups/<TIMESTAMP>/`
- The encrypted WAL chain in MinIO bucket `servix-wal/`
- `BACKUP_ENCRYPTION_PASSPHRASE` from prod `.env` (or your Bitwarden capture)

This procedure runs on an **isolated container** and does **not** touch live prod. It is intended for two cases:

1. **Real outage**: prod data corrupted, deleted, or unrecoverable → restore + bring up new postgres
2. **Audit / drill**: verify backups are restorable (A8-IV-019c — re-run quarterly)

Drilled 2026-05-18: wall-clock RTO **13 seconds** against 80 MB / 9 WAL segments. Scales roughly with base-tar size + WAL count.

---

## Prerequisites on the recovery host

- Docker engine
- The 3-of-3 secret set: `BACKUP_ENCRYPTION_PASSPHRASE`, `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`. If recovering on a fresh host (not `194.163.158.70`), copy these from Bitwarden out-of-band.
- Network reachability to MinIO. The drill runs MinIO inside `docker_servix-network` — for a real cross-host restore you may need to point at the off-site mirror (`OFFSITE_S3_*`).

## High-level flow

```
┌──────────────┐    1. mc cp (network)   ┌─────────────┐    2. gpg -d   ┌──────────────────┐
│  MinIO       │ ───────────────────────►│  helper     │ ──────────────►│  tmpdir/data     │
│ base-backups │                         │  container  │                │  + tmpdir/wal    │
│ + servix-wal │                         │ (ephemeral) │                └─────────┬────────┘
└──────────────┘                         └─────────────┘                          │
                                                                                  │ 3. mount RO
                                                                                  ▼
                                                                       ┌──────────────────────┐
                                                                       │  postgres:17-alpine  │
                                                                       │  --network none      │
                                                                       │  --memory=2g         │
                                                                       │  --user 70:70        │
                                                                       │  recovery_target_*    │
                                                                       │  promote on success  │
                                                                       └──────────────────────┘
```

## Step-by-step

### 1. Choose a recovery point and pick the closest base

```sh
# List base backups, pick the one most recently *before* your target time.
docker exec servix-backup mc ls local/servix-base-backups/ | sort

# Example: target=2026-05-18 22:00 UTC → pick base 20260518T204136Z
BASE_FOLDER=20260518T204136Z
```

If you only need the latest data (no point-in-time replay), pick the most recent base + omit `recovery_target_time` from step 6.

### 2. Stage the data on the recovery host

```sh
TMPDIR=$(mktemp -d /tmp/pitr-XXXXXX)
trap 'rm -rf "$TMPDIR" 2>/dev/null; docker rm -f pitr-helper pitr-recover 2>/dev/null' EXIT INT TERM
mkdir -p "$TMPDIR/data" "$TMPDIR/wal"
```

### 3. Pull + decrypt base + pg_wal

```sh
docker run -d --rm --name pitr-helper --network docker_servix-network \
  -v "$TMPDIR:/work" postgres:17-alpine sleep 600

docker exec pitr-helper sh -c '
  apk add --no-cache curl gnupg >/dev/null
  curl -fsSL https://dl.min.io/client/mc/release/linux-amd64/mc -o /usr/local/bin/mc
  chmod +x /usr/local/bin/mc
'

# Owner reads PASSPHRASE / MINIO_* from Bitwarden into shell env before this:
docker exec -e PP="$BACKUP_ENCRYPTION_PASSPHRASE" \
            -e MUSR="$MINIO_ROOT_USER" \
            -e MPW="$MINIO_ROOT_PASSWORD" \
            pitr-helper sh -c '
  mc alias set local "http://minio:9000" "$MUSR" "$MPW" --api S3v4
  for f in base.tar.gz.gpg pg_wal.tar.gz.gpg; do
    mc cp "local/servix-base-backups/'"$BASE_FOLDER"'/$f" "/work/$f"
    printf "%s" "$PP" | gpg --batch --passphrase-fd 0 --quiet --decrypt "/work/$f" > "/work/${f%.gpg}"
  done
'
```

### 4. Extract

```sh
docker exec pitr-helper sh -c '
  cd /work/data && tar -xzf /work/base.tar.gz
  mkdir -p /work/data/pg_wal && tar -xzf /work/pg_wal.tar.gz -C /work/data/pg_wal
  chown -R 70:70 /work/data
'
```

### 5. Pre-fetch every available WAL segment

`restore_command` runs as the postgres user inside an `--network none` container, so it can only `cp` from a local mount — fetch everything ahead of time.

```sh
docker exec pitr-helper sh -c '
  for seg in $(mc ls local/servix-wal/ | awk "{print \$NF}" | grep -v "\.backup\.gpg\$" | grep "\.gpg\$"); do
    name=${seg%.gpg}
    mc cp "local/servix-wal/$seg" "/work/wal/$seg"
    printf "%s" "$PP" | gpg --batch --passphrase-fd 0 --quiet --decrypt "/work/wal/$seg" > "/work/wal/$name"
    rm -f "/work/wal/$seg"
  done
  chown -R 70:70 /work/wal
'
docker rm -f pitr-helper
```

### 6. Write recovery configuration

```sh
cat > "$TMPDIR/data/postgresql.auto.conf" <<EOF
restore_command = 'cp /var/lib/postgresql/wal-fetch/%f %p'
recovery_target_action = 'promote'
# Optional — for time-targeted replay (must lie within available WAL):
# recovery_target_time = '2026-05-18 22:00:00 UTC'
EOF
touch "$TMPDIR/data/recovery.signal"
chown -R 70:70 "$TMPDIR/data" "$TMPDIR/wal"
```

### 7. Launch isolated postgres in recovery mode

```sh
docker run -d --name pitr-recover \
  --network none --memory=2g --user 70:70 \
  -v "$TMPDIR/data:/var/lib/postgresql/data" \
  -v "$TMPDIR/wal:/var/lib/postgresql/wal-fetch:ro" \
  postgres:17-alpine \
  postgres \
    -c hba_file=/var/lib/postgresql/data/pg_hba.conf \
    -c listen_addresses=127.0.0.1 \
    -c ssl=off \
    -c max_connections=200 \
    -c shared_buffers=256MB
```

`max_connections=200` matches prod's `postgresql.conf` — postgres refuses to recover with a value lower than the source instance.

### 8. Wait for promotion

```sh
until docker logs pitr-recover 2>&1 | grep -q 'database system is ready to accept connections'; do
  sleep 2
done
docker exec pitr-recover psql -U servix -d postgres -tAc 'SELECT pg_is_in_recovery();'
# Expected: f
```

### 9. Verify

```sh
docker exec pitr-recover psql -U servix -d servix_platform -tAc 'SELECT count(*) FROM tenants;'
docker exec pitr-recover psql -U servix -d postgres   -tAc 'SELECT pg_last_wal_replay_lsn();'
```

Compare against your expectation (or against prod, if prod is still readable).

### 10. Either dump-and-restore-into-prod, or replace prod's data dir

For surgical recovery of specific tables/rows:

```sh
docker exec pitr-recover pg_dump -U servix -d servix_platform -t public.<table> > /tmp/restored_table.sql
# … then load into prod via the documented restore flow.
```

For full-DB recovery (catastrophic loss), replace prod's `postgres_data` volume contents with `$TMPDIR/data` after stopping prod postgres. This is **destructive** on prod — require owner sign-off + a confirmed `< 1h` backup before doing it.

---

## Edge cases observed during the drill

| Symptom | Cause | Fix |
|---|---|---|
| `FATAL: max_connections = 100 is lower than primary` | postgres default in alpine image is 100, prod's `postgresql.conf` sets 200 | pass `-c max_connections=200` on the recovery container command line |
| `FATAL: recovery ended before configured recovery target was reached` | `recovery_target_time` is later than any record in available WAL (common on idle prods) | drop the target (replay-all) OR force more WAL generation before targeting |
| `cp: can't stat '00000002.history': No such file or directory` (warning, not FATAL) | postgres always probes for next-timeline history files | ignore — expected when no timeline branch exists |
| Restore failed with `could not open file "./pg_hba.conf.bak-…": Permission denied` | stray `.bak` files in postgres data dir, owned by root | A8-IV-049 fix — never write `.bak` files into the data dir; use `/tmp` or a sibling path |

## Followups still open

- **A8-IV-050** (LOW): `backup_manifest` is uploaded plaintext. Manifest leaks table names + file layout but no row data. Encrypt alongside `base.tar.gz` next time `base-backup.sh` is touched.
- **A8-IV-051** (TRIVIAL): `base-backup.sh` writes its log to `/backups/base-backup.log` but crontab redirects to `/backups/base.log`. Unify the path.

## Cadence

- **Drill quarterly** to keep this runbook honest. Re-run `iv-019c-drill.sh` (kept under `tooling/scripts/` as `pitr-drill.sh`).
- Re-time RTO after any non-trivial schema growth or WAL retention change.
- Update the "Drilled <date>: RTO <Xs>" line at the top of this doc after each drill.
