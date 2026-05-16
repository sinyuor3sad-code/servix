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

---

## A8-001 Amendment — Post-deployment investigations (2026-05-16)

### A8-IV-001: Tenant divergence investigation

- **Result:** Misinterpretation, not data loss. Production has had **4 tenants since inception**, not 17.
- Current tenants (from `tenants` table):
  - `platform-admin` → `platform_admin_db` (active, 2026-04-09) — **DB missing from pg_database**
  - `dantila-d0f48d47` → `servix_tenant_d0f48d47` (active, 2026-04-10) — DB present
  - `hthr-36e0b612` → `servix_tenant_36e0b612` (pending, 2026-04-16) — **DB missing** (pending status may be expected)
  - `test-ai-reception` → `servix_tenant_test_ai_reception` (trial, 2026-04-25) — DB present
- Apr 10 DR baseline naming (`servix_tenant_2fd4b25a`, `_43f7926a`, etc.) does NOT match current tenants — baseline is from a different instance (likely test/staging rebuilt between Apr 10 and Apr 25).
- **DR baseline NOT recoverable for current prod.** Flag for K3 DR project — baseline value is forensic/historical only.
- **Severity downgrade:** "35-day data loss for 17 tenants" → "35-day data loss for 2 active tenant DBs + platform" + 2 missing DBs need follow-up.
- **Production activity has collapsed since 2026-05-01.** Audit log shows ~150 events Apr 09–Apr 30, then only 5 events May 01–13, zero May 14+. Likely test environment or pre-launch lull.

### A8-IV-002: platform_admin_db missing investigation

- **Finding:** `platform-admin` tenant row has `status=active` and `database_name=platform_admin_db`, but no DB by that name exists in postgres. `hthr-36e0b612` (status=pending) also has missing DB — likely expected for `pending` status.
- **Decision deferred** — investigation only run as part of A8-IV-001 batch. Determining whether to mark orphan/repair/restore requires owner judgment + a separate ticket (`A8-IV-007` candidate).
- **Risk:** if anyone attempts to login as a platform-admin tenant user, `TenantMiddleware` will fail with "database does not exist" error.
- **Follow-up:** raise `A8-IV-007` to investigate whether `platform-admin` is a misconfigured seed row, a partial migration, or legitimate-but-DB-creation-race.

### A8-IV-003: Reboot 2026-05-13 root cause

- **Finding:** 4 reboots within 24 minutes (02:18 → 02:43 CEST). Boot sequence consistent with **Contabo hypervisor live-migration** pattern, not a crash or kernel update.
- Kernel package (`linux-image-6.8.0-111-generic`) was installed 2026-05-06 — 7 days before reboot, so unattended-upgrades is not the cause (would have required reboot earlier or set `/var/run/reboot-required` flag, which is currently absent).
- No kernel panic in journal before crash; pre-reboot logs show normal sshd brute force noise and UFW blocks.
- **Action:** owner to notify Contabo support to confirm scheduled migration window.
- **No further engineering action needed.**

### A8-IV-004: fail2ban verification

- **Status:** active + enabled (fail2ban 1.0.2-3ubuntu0.1).
- **Jails:** `sshd` (only).
- **Effectiveness:** 1,752 IPs banned cumulatively, 13,477 failed attempts total, 102 attempts in last 30 min, 2 currently banned, 18 currently failing.
- **nftables integration:** `f2b-table` exists with `addr-set-sshd` populated. ban action = `reject with icmp port-unreachable` on tcp/22.
- **sshd brute force pressure:** 138 failed attempts/hour, 2,432 in last 24h. Top attacker: `186.96.145.241` (226 attempts/24h).
- **Conclusion:** fail2ban is functioning correctly. Brute force pressure exists but is bounded by maxauthtries=3 + fail2ban bans + (after IV-005) PasswordAuthentication=no.

### A8-IV-005: SSH PasswordAuthentication hot-fix + root password lock

**Root cause:** 3 conflicting sshd_config.d files. sshd uses first-match-wins; `50-cloud-init.conf` (`PasswordAuthentication yes`) was overriding `99-servix-hardening.conf` (`PasswordAuthentication no`). Effective config exposed servix-admin to ~2,400 brute force attempts/day.

**Archaeological discovery:** `99-servix-hardening.conf` timestamp 2026-04-23 matches unrecorded `.env.bak.20260423_1256` mutation. Same likely actor/date. Content was correct (`PermitRootLogin no`, `PasswordAuthentication no`, `MaxAuthTries 3`, `LoginGraceTime 30`, `AllowUsers servix-admin`) but never effective due to file order. No git/Slack/Linear record of this 2026-04-23 hardening attempt.

**Actions:**

1. Fixed `PasswordAuthentication=no` in `/etc/ssh/sshd_config.d/50-cloud-init.conf` (the actual conflict source).
2. Initially archived `99-servix-hardening.conf` — then **RESTORED** after realizing content was correct (defense-in-depth value). Lesson: read config content before archiving, don't trust filename/timestamp.
3. Commented redundant `PermitRootLogin yes` in main `/etc/ssh/sshd_config` (was already overridden by sshd_config.d).
4. Locked root password via `sudo passwd -l root` — sudo via servix-admin's NOPASSWD ALL remains operational.
5. `servix-admin` password left as-is (P status) — kept as Contabo web console emergency fallback. SSH password vector closed regardless via `PasswordAuthentication=no`.

**Effective config post-fix (verified via `sshd -T`):**

```
passwordauthentication      no
permitrootlogin             no
pubkeyauthentication        yes
maxauthtries                3
logingracetime              30
allowusers                  servix-admin
kbdinteractiveauthentication no
usepam                      yes
```

**Verification:**

- 3 SSH sessions live during cutover (engineer + owner session 2 + owner session 3).
- Owner explicitly tested password auth from third session: `Permission denied (publickey).` ✓
- `sudo -n true` confirms NOPASSWD still operational ✓
- `/etc/shadow` root entry: `LOCKED` (starts with `!`); servix-admin: `NOT_LOCKED` ✓
- No SSH disruption during reload — same MainPID 4228, `Server listening on 0.0.0.0:22 + ::22`.

**Backup files (rollback path):**

- `/etc/ssh/sshd_config.bak-A8-IV-005-20260516_020720`
- `/etc/ssh/sshd_config.d/50-cloud-init.conf.bak-A8-IV-005-20260516_020720`
- `/etc/ssh/sshd_config.d/99-servix-hardening.conf.bak-A8-IV-005-20260516_020720`

**Follow-up flagged:**

- `A8-IV-006` (optional, not P0): rotate servix-admin password to random 32-byte base64, store in Bitwarden. Reason: existing password age/strength unknown, used only as Contabo console fallback so impact is contained, but rotation reduces residual exposure to zero. **Requires owner-side execution** (passphrase transport via chat is breach of Tier 🛑 rule).
- `A8-IV-007` (P1): investigate `platform-admin` tenant + missing `platform_admin_db` (orphan vs. partial migration vs. race condition).

### Tier rule additions learned during amendment

11. **Before archiving any config file, read its content** — don't trust filename/timestamp. The "prior failed attempt" assumption cost us a regression we caught via `sshd -T` preview before reload.
12. **`passwd -S` accepts only one user per call** on Ubuntu 24.04 (jammy `passwd 1:4.13+dfsg1`). Don't batch.
13. **Effective config preview via `sshd -T`** before any reload — catches regressions even when `sshd -t` passes (the latter validates syntax, not semantic outcome).

### A8-IV-008: Emergency rotation — servix DB superuser password (self-inflicted P0)

**Root cause:** While running A8-003 pre-flight diagnostics, the engineer used a flawed bash redaction pattern (`echo PLATFORM=\${PLATFORM_DATABASE_URL%%@*}@***`). The `%%@*` parameter expansion strips everything **after** the first `@`, but the password sits **before** the `@`. The resulting output exposed `servix:<19-char-plaintext-password>@***` to the chat transcript, leaking the production PostgreSQL superuser password.

**Detection:** Engineer self-detected during output review (length=19 matched the visible `Sv1x_Pr0d_2026!xKq9` string).

**Severity:** P0 — Postgres superuser credential compromise. All 4 production databases (`servix_platform`, `evolution_db`, `servix_tenant_d0f48d47`, `servix_tenant_test_ai_reception`) at risk for unauthorized SQL access, `DROP DATABASE`, `COPY FROM PROGRAM` RCE.

**Recovery:** Atomic rotation in single SSH heredoc, password generated **server-side only** (never traversed chat or shell args on host):

1. `openssl rand -base64 48 | tr -d "/+=" | head -c 32` (32 alphanumeric chars; the `-base64 24` variant was too short after `tr -d`).
2. Backed up `/root/servix/tooling/docker/.env` + `/root/servix/.env` as `.bak-A8-IV-008-<TS>`.
3. `ALTER ROLE servix WITH PASSWORD '...'` via temp SQL file (immediately shredded).
4. Read new SCRAM-SHA-256 hash from `pg_shadow`.
5. Updated `servix-pgbouncer:/etc/pgbouncer/userlist.txt` with new hash via `docker cp` + `chown postgres:postgres` (used `--user 0` for ownership fix; first attempt failed because `wc -c` from default container user couldn't read root-written file).
6. `sed -i` on both `.env` files to replace `POSTGRES_PASSWORD` + the password portion of `PLATFORM_DATABASE_URL`.
7. `docker compose up -d --force-recreate --no-deps pgbouncer api-1 api-2 backup evolution-api`.

**First attempt aborted** at step 5 due to `wc -c` permission error inside pgbouncer container (set -euo pipefail bailed). State at abort: PG had new password #1, pgbouncer userlist had hash of #1, but `.env` files still had OLD password and containers not yet recreated. **Half-rotated state** — recovery: generate password #2 and complete the cycle (password #1 was discarded; never recoverable from the failed run).

**Second attempt succeeded** with fixes:
- Verify userlist size on host (before `docker cp`) instead of inside container after.
- Use `docker exec --user 0` for chown/chmod inside pgbouncer container.
- All 5 containers recreated cleanly, all healthy within 18 seconds.

**Verification (clean-room from one-off `postgres:17-alpine` container on `docker_servix-network`):**

| Test | Expected | Result |
|---|---|---|
| OLD pw → postgres direct | reject | ✅ `FATAL: password authentication failed for user "servix"` |
| OLD pw → pgbouncer | reject | ✅ `FATAL: SASL authentication failed` |
| NEW pw → postgres direct | accept | ✅ `servix\|PostgreSQL 17.9...` |
| NEW pw → pgbouncer | accept | ✅ `servix` |
| WRONG pw → postgres | reject | ✅ `FATAL: password authentication failed` (sanity) |

**False-positive learning:** Initial verification from inside `servix-backup` container (with `-e PGPASSWORD=$OLD_PASS` flag) appeared to show old password being accepted. Re-test from clean one-off container proved auth was enforced correctly. The artifact is likely a libpq env-var interplay specific to backup container's pre-set `POSTGRES_PASSWORD` env (which is NEW post-rotation). Always verify auth changes from a freshly-spawned container with explicit env, not from a running container that has its own env.

**Smoke tests post-rotation:**
- `api-1`/`api-2` internal `/api/v1/health`: `db_status=ok, responseTime=5ms` ✅
- `backup` container `pg_isready -h postgres -U servix`: accepting ✅
- `backup` container `pg_isready -h pgbouncer -U servix`: accepting ✅
- 24 active connections post-rotation (was 23 before), all from newly-recreated containers (verified via `backend_start` in `pg_stat_activity`) ✅
- Backup at `20260516_040553` written successfully (entrypoint backup after pgbouncer recreate) — 5 files in MinIO ✅

**Tier rule additions:**

14. **NEVER use `${VAR%%@*}` for password redaction in URLs.** Use length-aware extraction: `sed -E 's|://[^:]+:([^@]+)@.*|\1|' | sha256sum` (hashes are safe; structural patterns are not). Or simply omit the URL from any output.
15. **Verify auth changes from a fresh container** (`docker run --rm --network <net> image psql ...`) not from running containers with pre-set env vars that interfere with `-e` overrides.
16. **`openssl rand -base64 N | tr -d "/+=" | head -c K`** — pick N such that `N*4/3 - 3` ≥ K. For K=32, use N≥48 (not N=24).
17. **`docker cp` then `--user 0 chown`** to set ownership inside containers that run as non-root.

**Action required from owner:**

- Capture new password into Bitwarden via:
  ```bash
  ssh servix-admin@194.163.158.70 "sudo grep '^POSTGRES_PASSWORD=' /root/servix/tooling/docker/.env"
  ```
- Suggested entry name: `Servix Prod — postgres servix role (rotated 2026-05-16 06:04 CEST)`
- After confirming, delete leaked-password backups:
  ```bash
  sudo shred -u /root/servix/tooling/docker/.env.bak-A8-IV-008-20260516_053750 /root/servix/.env.bak-A8-IV-008-20260516_053750
  ```
- Notify Anthropic support that a session transcript briefly contained a compromised production secret (for PDPL audit trail; secret no longer valid).

**Follow-up flagged:**

- `A8-IV-009`: rotate any other secrets the engineer may have echoed during this session (audit of all tool outputs needed). Initial review found only this one instance.

### A8-003: Postgres superuser separation (servix → servix_app for runtime)

**Goal:** Stop using `servix` superuser for runtime application connections. Create non-superuser `servix_app` role for `api-1`/`api-2` Prisma queries, restricting blast radius of any future SQL injection to DML on existing tables (no `DROP DATABASE`, no `COPY FROM PROGRAM` RCE, no role/db creation).

**Pre-flight findings (from diagnostic batch):**
- `servix` role: SUPERUSER + CREATEDB + CREATEROLE — owns all 5 databases
- 4 production databases: `servix_platform` (23 tables), `evolution_db` (37), `servix_tenant_d0f48d47` (51), `servix_tenant_test_ai_reception` (50)
- pgbouncer: `scram-sha-256` + `auth_query` mode, userlist had only `servix`
- api connections: 27 total, 1 active (safe for rolling restart, no peak time)
- pool_mode `transaction`, default_pool_size 50, max_client_conn 300

**Actions:**

1. **Created `servix_app` role** with `NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT` via idempotent `DO` block (handles both create-if-missing and update-password cases).

2. **Granted privileges per database** (4 transactions, all succeeded):
   - `GRANT CONNECT ON DATABASE`
   - `GRANT USAGE ON SCHEMA public`
   - `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public`
   - `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public`
   - `GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public`
   - `ALTER DEFAULT PRIVILEGES FOR ROLE servix IN SCHEMA public GRANT ... TO servix_app` (covers future tables created by `prisma migrate`)
   - Grant counts: 92 tables in `servix_platform`, 204 in `servix_tenant_d0f48d47`, 200 in `servix_tenant_test_ai_reception`, 148 in `evolution_db` (counts > raw table count because of default + per-table grants).

3. **Updated pgbouncer userlist.txt** to add `servix_app` SCRAM hash alongside existing `servix` (kept for backup container + admin tasks). Used `docker cp` + `--user 0` for ownership fix. Sent SIGHUP for in-memory reload.

4. **Added `SERVIX_APP_PASSWORD` to `.env`** on both `/root/servix/tooling/docker/.env` and `/root/servix/.env`. Did NOT modify `POSTGRES_PASSWORD` (still servix superuser, used by backup + evolution + future migration jobs).

5. **First recreate attempt revealed root cause of "appears to work but uses servix"**: the compose file hardcoded `PLATFORM_DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@pgbouncer:5432/...` — the `.env`'s `PLATFORM_DATABASE_URL` variable was being **ignored** because compose's `environment:` block takes precedence. Needed to edit the compose itself.

6. **Modified `tooling/docker/docker-compose.prod.yml`** (both `api-1` + `api-2` service blocks) to use `${SERVIX_APP_USER:-servix_app}:${SERVIX_APP_PASSWORD}` for `PLATFORM_DATABASE_URL` and `DATABASE_READ_URL`. The `:-` default means if `.env` doesn't define `SERVIX_APP_USER`, it falls back to `servix_app` literal. Change applied via surgical `sed -i` on prod (not full file replace — see drift note below) AND committed to git for repo parity.

7. **Rolling recreate** of `api-1` then `api-2` (`docker compose up -d --force-recreate --no-deps`). Each took ~15s. Both came up healthy on first try.

**Verification (clean-room from one-off `postgres:17-alpine` containers):**

| # | Test | Expected | Actual |
|---|---|---|---|
| 1 | `servix_app` SELECT via pgbouncer | success | ✅ `servix_app: 4 tenants` |
| 2 | `servix_app` DROP TABLE | reject | ✅ `ERROR: must be owner of table tenants` |
| 3 | `servix_app` CREATE DATABASE | reject | ✅ `ERROR: permission denied to create database` |
| 4 | `servix_app` CREATE ROLE | reject | ✅ `ERROR: permission denied to create role` |
| 5 | `servix_app` INSERT | success | ✅ BEGIN+INSERT pass auth; constraint violation expected (proves DML works at SQL layer) |
| 6 | `servix_app` COPY FROM PROGRAM | reject | ✅ `ERROR: permission denied to COPY to or from an external program` |
| 7 | `servix` superuser still functional | accept | ✅ `is_superuser=on` |
| 8 | backup pg_isready→postgres | success | ✅ `accepting connections` |
| 9 | `servix_app` SELECT on tenant DB | success | ✅ `servix_app\|51` tables visible |

**Runtime state post-deploy:**
- `pg_stat_activity` shows `servix_app: 5 connections`, `servix: 26 connections` (latter = backup + evolution + pgbouncer auth_user + monitoring)
- api-1: healthy, db responseTime 58ms ✓
- api-2: healthy, db responseTime 7ms ✓
- No permission errors in api logs over 90s observation window
- Evolution API + backup containers untouched (continue using servix as designed)

**Security improvement:** Any future SQL injection in api endpoints can now do (at worst) DML on existing tables. Cannot:
- DROP DATABASE / DROP TABLE (not owner)
- CREATE DATABASE / CREATE ROLE (no attributes)
- COPY FROM PROGRAM (RCE blocked — only `pg_execute_server_program` role members can)
- Cross to other databases (CONNECT grants are explicit per-DB)

**Production-vs-git drift flagged (`A8-IV-010` follow-up):**

While preparing to deploy A8-003, the surgical compose diff revealed that production's `/root/servix/tooling/docker/docker-compose.prod.yml` still contains the `n8n` service block + likely other content removed from main branch (commits `632babf chore(infra): remove unused n8n + gemini-proxy services` and `668ae0d chore(infra): remove n8n.servi-x.com from nginx routes`). Production has NOT been redeployed since those commits. Engineer aborted the original "full file replace via scp" approach to avoid silently removing n8n service entry; used surgical `sed -i` instead to apply only the 4 URL lines. A reconciliation pass between prod state and main is needed (`A8-IV-010` candidate). Until then, applying A8-003 in git via this PR keeps the change in source-of-truth; next deploy from main will re-apply it. Production already has the change applied directly.

**Tier rule additions:**

18. **Compose `environment:` block takes precedence over `.env` interpolation.** Setting `PLATFORM_DATABASE_URL` in `.env` does nothing if compose hardcodes the value (even with interpolation). Always check `docker exec <container> env | grep VAR` to confirm what the container actually sees, not what `.env` says.
19. **Use `sudo bash -e` not `sudo bash -se` with `set -eo pipefail`** when piping inside commands you don't want to abort the script — `pipefail` makes `cmd | head -N` exit 1 if `cmd` exits with anything but 0, even when the piped output is what you want.
20. **Compare prod state to git before any "replace whole file" operation.** If prod has drift (n8n still present, etc.), `scp` of git file will silently revert other state. Use surgical `sed -i` for targeted changes; reserve full-file replaces for known-clean targets.
21. **Production-vs-git drift detection should be a standing check** at the start of any compose-modifying card. `git diff $(scp prod:/path/file -) /local/path/file` or equivalent.

**Backup files (rollback path):**

- `/root/servix/tooling/docker/.env.bak-A8-003-20260516_080745`
- `/root/servix/.env.bak-A8-003-20260516_080745`
- `/root/servix/tooling/docker/docker-compose.prod.yml.bak-A8-003-20260516_081506` (from aborted full-replace attempt; can keep as evidence)
- `/root/servix/tooling/docker/docker-compose.prod.yml.bak-A8-003-surgical-20260516_081852` (from successful surgical sed)

**Action required from owner:**

- Capture `SERVIX_APP_PASSWORD` into Bitwarden:
  ```bash
  ssh servix-admin@194.163.158.70 "sudo grep '^SERVIX_APP_PASSWORD=' /root/servix/tooling/docker/.env"
  ```
- Suggested entry: `Servix Prod — servix_app non-superuser DB role (created 2026-05-16 08:07 CEST)`
- Schedule reconciliation pass between prod state and main branch (`A8-IV-010`)

**Follow-up flagged:**

- `A8-IV-010`: prod-vs-git compose drift (n8n + others). Needs full audit + reconciliation plan.
- `A8-IV-011`: extend A8-003 pattern to Evolution API (currently still uses `servix` superuser for `evolution_db`). Lower priority — Evolution data has less sensitivity than salon platform data, but defense-in-depth.
- `A8-IV-012`: investigate whether `n8n_db` exists in postgres (compose has n8n service, but A8-IV-001 survey showed only 4 databases — possibly orphan).

### A8-002: Postgres statement_timeout + idle_in_transaction + lock_timeout

- **Date:** 2026-05-16 (CEST)
- **Severity:** CRITICAL (P0)
- **Branch:** `chore/e8-prod-hardening`

### Context

Pre-fix all three timeouts were `0` (unlimited):
- `statement_timeout` = 0 → any query can run forever
- `idle_in_transaction_session_timeout` = 0 → idle txns hold locks/snapshots forever
- `lock_timeout` = 0 → blocked txns wait forever for a lock

Runaway query on one tenant DB starves the shared PgBouncer pool (`max_db_connections=150`, `default_pool_size=50`, `pool_mode=transaction`) → cascade failure across all tenants.

### Pre-flight diagnostic findings

- Current values: all three at `0`
- Currently-running queries > 25s: **none** (only the diagnostic query itself, 0s)
- Idle-in-transaction sessions > 60s: **none** (clean — no transaction leaks)
- `pg_stat_statements` extension: **not installed** on prod (logged as `A8-IV-013` followup — needs postgres restart, not just reload)
- `postgresql.conf` overrides for these settings: **none** (defaults)
- `postgresql.auto.conf`: empty (no prior ALTER SYSTEM)
- Connections: 34 idle + 1 active + 5 internal (low activity, safe for change)
- **PgBouncer `query_timeout = 30`** — already enforcing a 30s ceiling client-side. Setting PG `statement_timeout=30s` aligns server-side with existing proxy behavior (no behavioral change, just stricter cleanup).

### Actions

1. Applied via ALTER SYSTEM on prod:
   ```sql
   ALTER SYSTEM SET statement_timeout = '30s';
   ALTER SYSTEM SET idle_in_transaction_session_timeout = '60s';
   ALTER SYSTEM SET lock_timeout = '5s';
   SELECT pg_reload_conf();
   ```
2. Verified persistence in `/var/lib/postgresql/data/postgresql.auto.conf` (3 new lines).
3. Persisted same values in `tooling/postgres/postgresql.conf` (this commit) so future rebuilds from the config file keep the policy.

### Verification

**Functional tests** (immediate, after reload):

| Test | Expected | Actual |
|---|---|---|
| `SHOW statement_timeout` | `30s` | ✅ `30000 ms` (source: configuration file) |
| `SHOW idle_in_transaction_session_timeout` | `60s` | ✅ `60000 ms` |
| `SHOW lock_timeout` | `5s` | ✅ `5000 ms` |
| `pg_sleep(35)` | cancel @30s | ✅ `30s elapsed, "canceling statement due to statement timeout"` |
| `pg_sleep(5)` | succeed | ✅ `short query OK` |
| lock_timeout race (LOCK TABLE held by session 1, session 2 attempts) | cancel @5s | ✅ `5s elapsed, "canceling statement due to lock timeout"` |

**Smoke tests** (immediate):

- `api-1` `/api/v1/health`: `db_status=ok responseTime=10ms` ✓
- `api-2` `/api/v1/health`: `db_status=ok responseTime=15ms` ✓
- `evolution-api` HTTP root: `{"status":200,"message":"Welcome to the Evolution API"}` ✓
- `backup` container `pg_dump --schema-only`: 1539 lines of SQL ✓

**20-minute observation window** (started immediately post-ALTER; aborted at 20min when ≥ 15min sample provided sufficient signal):

- `api-1` timeout/cancel events (excluding test queries): **0**
- `api-2` timeout/cancel events: **0**
- `api-1` 5xx responses: **0**
- `api-2` 5xx responses: **0**
- Postgres real cancellations (excluding our `pg_sleep` and `LOCK TABLE` tests): **0**
- `evolution-api` errors: clean
- Settings drift check: **none** (still 30000/60000/5000 ms from configuration file)
- All 6 containers: `running|healthy` (no restarts)

### Coordination

- Engineer 2 will reconcile these 3 lines into `postgresql.conf` alongside their schema-level config work (was V-16 in their queue). The change is now in `chore/e8-prod-hardening`; do not merge to `main` until E2 reviews to avoid double-touch.
- Engineer 3 (rate-limit / websockets) unaffected.
- Engineer 4 (money/perf) — long-running ZATCA reports may need `SET LOCAL statement_timeout = 0` inside their batch session; flag for their notice but no immediate action.

### Followup tickets

- `A8-IV-013`: install `pg_stat_statements` extension. Currently `shared_preload_libraries` in repo's `postgresql.conf` already lists it, but prod is NOT using that file. Requires postgres **restart** (not reload) — needs maintenance window. Bundle with A8-IV-014 + A8-011.
- `A8-IV-014`: prod-vs-git drift on `postgresql.conf`. Repo has rich config (PITR archive_command, slow query log, pg_stat_statements, autovacuum tuning) but prod runs from postgres image defaults. Same pattern as A8-IV-010 (compose drift) and A8-008 (nginx drift) → meta-finding: production deployment never picks up infra config changes from git. Owner to scope as K3 sub-project.
- `A8-IV-015` (meta): drift detection systemic gap. 3 known drift surfaces (compose, postgresql.conf, nginx). Need standing audit check at start of each card. If 5+ instances found, escalate to K3 sub-project.

### Tier rules added during execution

22. **PgBouncer `query_timeout` doesn't replace PG `statement_timeout`.** PgBouncer cancels the connection at 30s but PG continues holding resources (lock, snapshot, undo) until it notices the disconnect. Server-side `statement_timeout` is what actually kills the work. Check both layers when reasoning about query budgets.
23. **`shared_preload_libraries` changes require postgres RESTART, not reload.** Adding `pg_stat_statements` via ALTER SYSTEM + reload does NOT load the library. Plan such changes for maintenance windows.

### A8-IV-002 (followup): platform-admin tenant diagnostic results

- Tenant row: `cde3a2d9-...`, slug `platform-admin`, `database_name=platform_admin_db`, `status=active`, created 2026-04-09 11:11 UTC, no `pending_deletion_at`
- 1 user linked (presumably `admin@servi-x.com`, last login 2026-05-13 01:43 UTC — successful)
- 0 subscriptions, 0 invoices
- 1 audit log entry total: `trigger_backup` action on 2026-04-16 by user `f49e98ae-...`
- **Database `platform_admin_db` does not exist** in `pg_database` (verified via `SELECT datname FROM pg_database`)
- **Conclusion:** Reserved super-admin slug pattern. `admin@servi-x.com` logged in successfully on 2026-05-13, suggesting the super-admin code path bypasses `TenantMiddleware`'s per-tenant DB resolution. Safe to leave the row alone.
- **Decision:** No action this session. Tracked as `A8-IV-007` for proper investigation (does the super-admin login path actually skip per-tenant DB? Should `database_name` be `NULL` instead of a phantom DB name? What happens if a non-super-admin user is accidentally linked to `platform-admin` tenant?).
