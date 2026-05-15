# E8 Changelog — Production Server Hardening

Engineer 1 (Platform & Infrastructure). Append-only log of changes applied to production server `194.163.158.70` and the `chore/e8-prod-hardening` branch.

---

## A8-001 — Restore backup encryption + comment broken host crontab

- **Date:** 2026-05-15 (CEST) / 2026-05-15 22:36 UTC
- **Engineer:** Engineer 1 (Platform & Infrastructure)
- **Branch:** `chore/e8-prod-hardening`
- **Severity:** CRITICAL (PDPL violation — backups disabled 35 days)

### Context

Backup container `servix-backup` was created `2026-04-30T23:48:21Z` without `BACKUP_ENCRYPTION_PASSPHRASE` set in `/root/servix/tooling/docker/.env`. The script's preflight check (lines 41–44 of `/scripts/backup.sh`) emits `FATAL: BACKUP_ENCRYPTION_PASSPHRASE is required (PDPL)` and `exit 1` whenever invoked. Cron fired every 6h since Apr 30 and every tick failed identically. Last successful encrypted backup in this container: never. Last successful backup of any kind: `20260410_060000` (35-day gap).

A separate host crontab line `0 3 * * * /root/servix/scripts/backup.sh ...` referenced a script path that does not exist on the host filesystem (the script lives inside the container at `/scripts/backup.sh`, mounted from `tooling/docker/scripts/backup.sh`). The host crontab was a noisy no-op log emitter.

### Discoveries during execution (which changed the plan)

1. **`docker compose restart` does NOT reload `.env`.** Initial plan said "restart backup". Container env vars are baked at creation. After adding the passphrase to `.env` and running `docker compose restart`, the container still saw `BACKUP_ENCRYPTION_PASSPHRASE=` (empty). The fix required `docker compose up -d --force-recreate --no-deps backup` to recreate with new env. Runbook update required for any future env changes (see Lessons Learned).

2. **Audit assumption "FATAL once on startup" was wrong.** The script logs FATAL at every cron tick (visible in `/backups/backup.log` — 65 entries over 15 days), not just at container startup. The `docker logs` stream truncated to 2 historical lines from Apr 30 misleadingly suggested otherwise.

3. **DR baseline window broader than first scan suggested.** First `tail -10` scan showed 8 backup folders (Apr 09–10). Full survey revealed **23 folders Apr 06 → Apr 10 12:00**, with file counts growing from 4 → 19 as tenants were added. Two empty placeholders (`20260408_193736`, `20260410_120001`) indicate prior partial-failure events.

4. **Last successful backup was `20260410_060000`** (19 files, ~116K). The next tick `20260410_120001` is empty — this was the moment encryption enforcement broke. Gap = 35 days, not the originally-estimated 34.

5. **`/scripts/backup.sh` is bind-mounted `:ro` without exec bit** (`-rw-r--r--`). Cron works because crontab uses `/bin/sh /scripts/backup.sh`. Direct `docker exec /scripts/backup.sh` returns exit 126 ("permission denied"). Workaround: invoke via `/bin/sh /scripts/backup.sh` to match crontab semantics.

6. **Production has 4 databases now**, not the 19 in the Apr 10 baseline:
   - `servix_platform`, `evolution_db`, `servix_tenant_d0f48d47`, `servix_tenant_test_ai_reception`
   This is a major divergence — most tenants from Apr 10 baseline are no longer present. Either intentional cleanup or pre-launch tenant churn.

7. **Server timezone confirmed `Europe/Berlin` (UTC+2 CEST)** while application services run in container UTC. Date math across the boundary needs care (host `date +%Y%m%d`=20260516 while container files dated `20260515`). Validates A8-009 priority.

8. **MinIO bucket has versioning enabled.** Stale folders `20260423_*` → `20260430_*` (~30 entries) were rotated by `cleanup_old_minio()` during this run. They appear as `0B` placeholder entries in `mc ls` (delete markers). Not a bug.

9. **`set -eu` in backup.sh has no `pipefail`.** A `pg_dump | gzip` failure where pg_dump fails would be masked by gzip's exit 0. Logged as candidate for V-120 (script hardening pass).

10. **Pre-existing `.env.bak.20260423_1256`** in `/root/servix/tooling/docker/` — someone modified `.env` on Apr 23 (during the gap, before container creation Apr 30). Unknown author, unknown change.

### Actions taken (in execution order)

1. Generated 64-char base64 passphrase via `openssl rand -base64 48` inside an SSH heredoc (value never traversed shell variables, never logged). Stored in `/root/servix/tooling/docker/.env` (chmod 600 preserved).
2. Owner stored value in Bitwarden ("Servix Prod — BACKUP_ENCRYPTION_PASSPHRASE (2026-05-15)") + offline copy.
3. Created `.env.bak-A8-001-20260515_150905` canonical snapshot (post-mutation, chmod 600).
4. Commented host crontab line:
   ```
   # DISABLED 2026-05-15 (E8.M1 A8-001 - missing script): 0 3 * * * /root/servix/scripts/backup.sh >> /var/log/servix-backup.log 2>&1
   ```
   Original crontab preserved at `/tmp/host-crontab-backup-20260515_145217.txt`.
5. Volume archive created: `/tmp/docker_backup_data_snapshot_20260515_145217.tar.gz` (956K).
6. Preserved DR baselines (chmod 700 dirs, 600 files):
   - `/root/dr-baseline-apr10-20260515.preserved/` — 19 files from `20260410_060000` (last successful)
   - `/root/dr-baseline-apr09-20260515.preserved/` — 9 files from `20260409_084957` (ad-hoc snapshot)
   SHA256 verified equal to source for `servix_platform.sql.gz`.
7. **Recreated** `servix-backup` container via `docker compose up -d --force-recreate --no-deps backup`. Env interpolation re-ran, passphrase loaded into container env (verified length=64).
8. Two successful backups written automatically + manually:
   - `servix-backups/20260515_223615/` (entrypoint startup backup): 5 files, ~934 KiB
   - `servix-backups/20260515_223745/` (manual `docker exec /bin/sh /scripts/backup.sh`): 5 files, ~934 KiB
   Both encrypted (`.sql.gz.gpg`), uploaded to MinIO, manifest recorded `success: 4 / failed: 0`.
9. Prometheus textfile metric written: `/var/lib/docker/volumes/docker_node_exporter_textfile/_data/servix_backup.prom` (809 bytes, includes `servix_backup_last_success_timestamp`).
10. Restore test: spun up `--network none --rm --memory=2g --cpus=1 postgres:17-alpine` isolated container. Streamed `mc cat → gpg --decrypt → gunzip → psql`. Pipeline exits `0,0,0,0`. Restored `servix_platform`: 23 tables, **tenant count 4 = prod tenant count 4** ✓. Latest audit log timestamp in restored DB: `2026-05-13 01:51:30.636+00` (consistent with last server reboot). Container destroyed, passphrase file removed.

### Verification outputs

- `BACKUP_ENCRYPTION_PASSPHRASE` length in container env: **64** (post-recreate)
- Manual backup exit code: **0**
- New backup file count (per folder, MinIO): **5** (4 dbs + 1 manifest, all `.gpg`)
- Total upload size: **961938 bytes**
- `failed-uploads/` directory: **does not exist** (good)
- FATAL entries since recreate: **0**
- `servix_backup.prom` metrics file: **present, 809 bytes**
- Restore pipeline: **mc=0, gpg=0, gunzip=0, psql=0**
- Restored vs prod tenant count: **4 = 4** ✓

### DR baseline status (post-execution)

| Location | Status | File count |
|---|---|---|
| `/var/lib/docker/volumes/docker_backup_data/_data/20260410_060000` (in-volume) | intact (rotation is MinIO-only) | 19 |
| `/var/lib/docker/volumes/docker_backup_data/_data/20260409_084957` (in-volume) | intact | 9 |
| `/root/dr-baseline-apr10-20260515.preserved/` | intact, chmod 700/600 | 19 |
| `/root/dr-baseline-apr09-20260515.preserved/` | intact, chmod 700/600 | 9 |
| `/tmp/docker_backup_data_snapshot_20260515_145217.tar.gz` | 956K | n/a |

### Secret handling audit

- Passphrase value never appeared in chat transcripts
- Passphrase value never appeared in shell history (heredoc scope only)
- Passphrase value never written to `/tmp` as plaintext (gpg `--passphrase-file` used `umask 077` to create `/tmp/pp.txt` mode 600, deleted in cleanup)
- Bitwarden + offline copy confirmed by owner

### Lessons learned (runbook updates required)

1. **`docker compose restart` does NOT reload `.env` files.** When env values change, use `docker compose up -d --force-recreate --no-deps <service>`. Affects: A8-002 (Postgres superuser), A8-004 (Redis password), V-10 (Vault prod), and any future env-changing card.
2. **Redaction in diagnostic output must use length-check, not regex substitution.** `sed 's|=.*|=<REDACTED>|'` masks empty values as `<REDACTED>` because `.*` matches zero chars. Use `awk 'length($0)' | wc -c` patterns instead.
3. **Bind-mounted `:ro` scripts lose exec bit on host.** Use `docker exec <container> /bin/sh <script>` to match crontab semantics rather than direct invocation.
4. **Glob expansion under `sudo` requires `sudo bash -c '...'`** for paths under root-owned directories like `/root` (mode 700). The calling shell's glob expansion fails first.
5. **Initial diagnostics should always include full directory survey, not `tail`.** First scan of `/backups/` cut off Apr 06–08 entries.
6. **Timezone mismatch between host (CEST) and container (UTC) creates date-math hazards** in shell scripts that compute `TODAY`. A8-009 priority confirmed.

### Remaining concerns flagged for follow-up

- **Most tenants from Apr 10 baseline are gone in current prod.** Investigate whether intentional or data loss — independent ticket.
- **MinIO `cleanup_old_minio` deleted Apr 23–30 entries during this run** — likely empty placeholders from failed backup attempts (FATAL every cron tick). No pre-cleanup snapshot taken, so cannot retroactively confirm. Concern level: low (matches FATAL pattern), but flag for K3 DR review.
- **Mystery `.env` mutation on 2026-04-23** — `.env.bak.20260423_1256` exists with no recorded change attribution. Author and intent unknown. Review alongside V-10 (Vault production migration) to determine if its contents diverge from current `.env`.
- **DR baselines from 2026-04-09 to 2026-04-10 are unencrypted `.sql.gz`** (pre-PDPL). Historical PDPL gap.
- **`backup.sh` uses `set -eu` without `pipefail`.** Candidate for V-120 (script hardening pass).
- **20-day container gap (Apr 10 → Apr 30)** where no backup container existed at all — beyond the script-failure window. Needs K3 (DR) review to prevent recurrence.
- **Server reboot 2026-05-13 cause unknown** — uptime data shows fresh boot ~2.5 days before A8-001 work. No planned-maintenance record. Could be kernel auto-update via unattended-upgrades, or manual intervention. Requires audit of `/var/log/syslog` around that date.
- **`mc cp ... >/dev/null 2>&1`** in `backup.sh` swallows upload error messages. V-115 related.

### Next task

`A8-003` — Postgres superuser separation (replace `servix` superuser with `servix_app` non-superuser for application connections). Requires runbook update to use `up -d --force-recreate` post-`.env` change.
