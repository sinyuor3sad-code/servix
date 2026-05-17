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

### A8-004: Redis password CLI exposure fix (+ A8-005 partial: secrets sprawl baseline) + 2 self-inflicted leaks

- **Date:** 2026-05-16 (CEST)
- **Severity:** CRITICAL (P0)

### Context

Pre-fix: `command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}` rendered the password literally into `docker inspect servix-redis --format '{{json .Config.Cmd}}'`, visible to anyone with `docker` group access on host. The compose healthcheck `test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]` produced the same exposure in `Config.Healthcheck.Test`.

### Solution

1. **`/etc/servix/redis.conf`** on prod host — `requirepass`, `appendonly`, `appendfsync` directives. File `chmod 644 root:root` (file readable by container redis user via bind-mount); parent directory `/etc/servix/` `chmod 700 root:root` (host shell traversal blocked for non-root).
2. **Compose `redis.command`** changed to `["redis-server", "/usr/local/etc/redis/redis.conf"]`. No password in CLI.
3. **Compose `redis.volumes`** adds `- /etc/servix/redis.conf:/usr/local/etc/redis/redis.conf:ro` bind-mount.
4. **Compose `redis.healthcheck.test`** changed to `["CMD-SHELL", "redis-cli -a \"$(awk '/^requirepass/{print $2}' /usr/local/etc/redis/redis.conf)\" ping"]`. Healthcheck reads password from file at each invocation; no literal in compose render.
5. **Password rotated** server-side via `openssl rand -base64 32` (44-char value, written directly into redis.conf + `.env`, never echoed to chat at generation time).

### Two self-inflicted P0 leaks during this work

**Leak #1 (pre-fix diagnostic exposed the OLD password):**

During A8-004 pre-flight (`docker inspect servix-redis --format '{{json .Config.Cmd}}'`), the diagnostic command returned the full `--requirepass <PASSWORD>` array element — the very vulnerability A8-004 was meant to fix. This is exactly the residual-risk pattern the audit anticipated; it exposed the OLD password in the chat transcript. Rotation triggered as part of A8-004 main path (single atomic operation: fix CLI exposure + rotate compromised value).

**Leak #2 (post-rotation verification test was malformed):**

After rotation, attempted to demonstrate that the new `/etc/servix/redis.conf` (chmod 644) was protected by parent directory `chmod 700` by running `cat /etc/servix/redis.conf` "as non-root". The test was inside a `sudo bash -e` wrapper, so the `cat` actually ran as root and echoed the NEW password to chat. Required a SECOND rotation cycle (P3 password) to invalidate.

**Tier rules added:**

- **24. Pattern detection, not value retrieval, for secret-in-config diagnostics.** Use `grep -q requirepass && echo CONFIRMED` not `docker inspect ... --format '{{json .Config.Cmd}}'`. The former proves the vulnerability exists; the latter exposes the value.
- **25. Privilege-escalated wrappers invalidate "non-root" tests.** Any test running inside `sudo bash -e` is root, even if the inner command isn't prefixed with sudo. To verify host shell access blocked, the test must be invoked in a separate, non-privileged shell (e.g., `runuser -u <user> -- cat ...`, or via SSH from owner's machine with a non-root account, or out-of-band).

### Actions (in execution order)

1. Backup `.env` + `docker-compose.prod.yml` on prod.
2. Created `/etc/servix/` (`chmod 700 root:root`).
3. Generated password #1 + wrote `/etc/servix/redis.conf` + updated `.env REDIS_PASSWORD`.
4. Surgical sed on prod compose: `command:` line replaced, `volumes:` bind added.
5. Healthcheck rewrite via Python (sed produced invalid YAML due to nested quotes — Tier rule 19/20 pattern).
6. Recreated `redis` container. **First attempt failed** — file perms `600 root:root` blocked container redis user (UID 999) from reading. Tried `chown root:999` (mapping to host's `systemd-journal` group, GID 999 in container = `redis` group GID 1000) — also failed.
7. Final fix: `chmod 644 root:root` on `redis.conf`. Defense-in-depth = parent dir `chmod 700` blocking host shell access. Redis container started clean (`Ready to accept connections tcp`).
8. Recreated `api-1` + `api-2` to load new `REDIS_PASSWORD` env.
9. Flawed verification test (Leak #2) → P3 rotation triggered.
10. P3 rotation: re-wrote `redis.conf` + `.env` with fresh `openssl rand -base64 32` value, recreated redis + api-1 + api-2.

### Verification (post-P3, clean-room from one-off `redis:8-alpine` on `docker_servix-network`)

| Test | Expected | Result |
|---|---|---|
| `docker inspect Config.Cmd` contains `requirepass` | 0 occurrences | ✅ `["redis-server","/usr/local/etc/redis/redis.conf"]` |
| `docker inspect Config.Healthcheck.Test` contains literal password | none | ✅ contains `awk` reading from file |
| OLD password #2 → `redis-cli ping` | reject | ✅ `WRONGPASS invalid username-password pair` |
| NEW password #3 → `redis-cli ping` | accept | ✅ `PONG` |
| NO password → `redis-cli ping` | reject | ✅ `NOAUTH Authentication required` |
| `api-1` `/health` `db_status` | `ok` | ✅ |
| `api-2` `/health` `db_status` | `ok` | ✅ |
| All 7 containers state | running/healthy | ✅ (redis: running\|healthy, others unchanged) |

### A8-005 partial (secrets sprawl baseline — full work is V-10 Vault territory)

Audited current `docker inspect` env exposure for downstream rotation planning. The following secrets are currently env-baked (visible to `docker group` members via `docker inspect <container>`):

- `api-1`/`api-2`: `JWT_ACCESS_SECRET` (37), `JWT_REFRESH_SECRET` (38), `ENCRYPTION_KEY` (64), `META_APP_SECRET` (32), `EVOLUTION_API_KEY` (64), `GEMINI_API_KEY` (39), `CLOUDFLARE_AI_TOKEN` (53), `WHATSAPP_WEBHOOK_VERIFY_TOKEN` (26), `REDIS_PASSWORD` (44), `PLATFORM_DATABASE_URL` (URL with `servix_app` password)
- `evolution`: `AUTHENTICATION_API_KEY` (64), `DATABASE_CONNECTION_URI` (URL with `servix` superuser password)
- `minio`: `MINIO_ROOT_PASSWORD` (20)
- `grafana`: `GF_SECURITY_ADMIN_PASSWORD` (10)

`.env` perms = `600 root:root` (verified, in good state since A8-001 epoch).

Full migration to Docker Secrets / Vault deferred to **V-10** (E7 P0). This card only confirmed baseline + fixed the worst offender (Redis CLI exposure).

### Backup files (rollback path)

- `/root/servix/tooling/docker/.env.bak-A8-004-20260516_175209` (pre-rotation)
- `/root/servix/tooling/docker/.env.bak-A8-004-P3-20260516_180821` (post-leak-2, contains leaked P2 value)
- `/root/servix/tooling/docker/docker-compose.prod.yml.bak-A8-004-20260516_175209` (pre-compose-edit)

**Owner action required (after Bitwarden P3 capture):**
```bash
sudo shred -u \
  /root/servix/tooling/docker/.env.bak-A8-004-20260516_175209 \
  /root/servix/tooling/docker/.env.bak-A8-004-P3-20260516_180821
```

### Followup tickets

- `A8-IV-016`: `RedisIoAdapter` socket.io scaling adapter logs `"Failed to connect Redis IO adapter, falling back to in-memory: Invalid URL"`. Pre-existing (visible before A8-004). Likely cause: base64 password chars (`/+=`) not URL-encoded when api code constructs `redis://default:<pass>@host:port`. The cache/queue connections (BullMQ via ioredis with separate `host`/`port`/`password` fields) work fine — `db_status=ok`. Investigation needed: which code path builds the socket.io adapter URL, and is URL-encoding missing?
- `A8-IV-017`: Owner must run blocked-access test out-of-band from a non-root SSH session to confirm `/etc/servix/redis.conf` is unreachable to non-root host users:
  ```bash
  ssh servix-admin@194.163.158.70 'cat /etc/servix/redis.conf 2>&1; ls /etc/servix/ 2>&1'
  ```
  Expected: both fail with `Permission denied`.

### A8-008: n8n nginx drift cleanup

- **Date:** 2026-05-16 (CEST)
- **Severity:** HIGH

### Context

Production nginx active config (`docker exec servix-nginx nginx -T`) contained 8 references to `n8n.servi-x.com` even though:
- No `n8n` container running (`docker ps -a --filter name=n8n` empty)
- No `n8n_db` in postgres (only 4 DBs: `servix_platform`, `evolution_db`, 2 tenant DBs)
- Result: any request to `https://n8n.servi-x.com/` returned `HTTP 502 Bad Gateway` (nginx tried to proxy to non-existent `http://n8n:5678` upstream)

### Drift archaeology

- Commit `668ae0d chore(infra): remove n8n.servi-x.com from nginx routes` (Wed May 13) cleanly removed the n8n server block from `tooling/docker/nginx/nginx.conf` in git.
- But that commit only lived on branch `fix/dashboard-sw-cache-leak` (owner WIP, never merged to `main`). Origin/main `b5452d2` does NOT include it.
- On prod host, the on-disk `nginx.conf` somehow already had 0 n8n refs (modified May 13 07:04 CEST — same day as the commit). Likely the owner SCP'd the file manually but never reloaded nginx.
- **Active nginx process still held the OLD config in memory** — 8 n8n refs visible via `nginx -T`, returning 502s for n8n.servi-x.com.

### Actions

1. **Cherry-picked `668ae0d`** into `chore/e8-prod-hardening` (`git cherry-pick --no-commit`) → local `nginx.conf` now matches the cleaned version. Conflict-free apply.
2. **SCP'd cleaned config to prod** at `/tmp/nginx.conf.A8-008.new`, then `mv` to `/root/servix/tooling/docker/nginx/nginx.conf` with backup at `.bak-A8-008-20260516_215325`.
3. **First reload attempt failed.** `nginx -t` passed and `nginx -s reload` succeeded, but `nginx -T` still showed 8 n8n refs. Diagnosed: `mv` changed the host file inode; the running container's bind-mount tracked the OLD inode (now orphaned). Container saw 13631-byte stale file (inode 4537947); host had 11808-byte clean file (inode 4456722).
4. **Recreate nginx container** via `docker compose up -d --force-recreate --no-deps nginx` to re-attach bind-mount to current inode. Inodes match post-recreate (`host=4456722 container=4456722`). 0 n8n refs in running config.

### Verification

| Test | Expected | Actual |
|---|---|---|
| `nginx -T \| grep -c n8n` (active) | 0 | ✅ 0 |
| `grep "server_name.*n8n"` (any server_name has it) | none | ✅ none |
| `curl https://api.servi-x.com/api/v1/health` | 200 | ✅ 200 |
| `curl http://n8n.servi-x.com/` | 301 (default redirect, not 502) | ✅ 301 |
| `curl https://n8n.servi-x.com/` | 301 / default | ✅ 301 |
| `nginx` container | running | ✅ |
| `api-1`/`api-2`/all others | unchanged healthy | ✅ |
| nginx error log post-reload | clean | ✅ |

### Tier rule added

26. **Bind-mounted single files: `mv` breaks the mount.** Docker tracks the inode at mount time; `mv` (which is `rename(2)`) creates a new inode. The container continues serving the orphaned old inode. To update bind-mounted files: either edit in place with `cat > file` / `truncate + write` (preserves inode), OR recreate the container after the `mv`. Bind-mounted **directories** are safer because they re-resolve on each access, but single-file mounts are inode-pinned.

### Followup tickets

- `A8-IV-010` (still open): prod `docker-compose.prod.yml` still defines the orphan `n8n` service block (no container, but the YAML references it). Same for `gemini-proxy` per commit `632babf`. Owner to reconcile prod compose with main when ready (broader scope than A8-008).
- `A8-IV-018`: Cloudflare DNS record for `n8n.servi-x.com` still exists. Per `668ae0d` commit body: "Cloudflare DNS record for n8n.servi-x.com still needs manual removal." Owner action required (out of engineer SSH scope).

### Backup files (rollback path)

- `/root/servix/tooling/docker/nginx/nginx.conf.bak-A8-008-20260516_215325` (last-known-good prod version, May 13 mtime)

### A8-017: 4GB swap + vm.swappiness=10

- **Date:** 2026-05-16 (CEST)
- **Severity:** P2 (catastrophe-prevention)

### Context

VM had **0 bytes of swap** configured. Under memory pressure (postgres + 8 containers on 11GB RAM), kernel OOM killer would terminate processes instead of paging. Pure host state change — no compose/repo files affected.

### Diagnostic (pre-flight)

- mem: 11Gi total, 3Gi used, 8.7Gi available (healthy)
- swap: 0
- disk free `/`: 114GB (room for 4GB swapfile)
- `vm.swappiness`: 60 (kernel default; too aggressive for SSD)
- no existing `/swapfile`
- fstab: 3 standard entries (root, /boot, /boot/efi)

### Actions (host-only)

1. `fallocate -l 4G /swapfile && chmod 600`
2. `mkswap /swapfile` → UUID assigned
3. `swapon /swapfile` → 4G priority -2
4. Appended to `/etc/fstab`:
   ```
   # A8-017 — added 20260516_215843
   /swapfile none swap sw 0 0
   ```
5. `sysctl -w vm.swappiness=10` (runtime)
6. Appended to `/etc/sysctl.conf`:
   ```
   # A8-017 — added 20260516_215843
   vm.swappiness = 10
   ```

### Verification

| Test | Expected | Actual |
|---|---|---|
| `swapon --show` | `/swapfile 4G` | ✅ `/swapfile file 4G 0B -2` |
| `free -h` swap line | `4.0Gi` | ✅ `4.0Gi 0B 4.0Gi` |
| `sysctl vm.swappiness` | `10` | ✅ `10` |
| `findmnt --fstab /swapfile` | entry present | ✅ `none /swapfile swap sw` |
| `mount -fa` (dry-run) | no errors | ✅ (no output) |
| All 8 containers | unchanged healthy | ✅ |

### Backup files (rollback path)

- `/etc/fstab.bak-A8-017-20260516_215843`
- `/etc/sysctl.conf.bak-A8-017-20260516_215843`

Rollback: `swapoff /swapfile && rm /swapfile && cp <bak> /etc/fstab && cp <bak> /etc/sysctl.conf && sysctl -p`.

### A8-011: log_connections + log_disconnections + audit-grade log_line_prefix

- **Date:** 2026-05-16 (CEST)
- **Severity:** P1 (audit / PDPL forensic capability)

### Context

Pre-fix all three logging settings were minimal:
- `log_connections = off` → no record of WHO connected, WHEN, from WHERE
- `log_disconnections = off` → no session duration / cleanup tracking
- `log_line_prefix = '%m [%p] %u@%d '` → missing line counter, client IP, application name
- pgbouncer `log_connections = 0`, `log_disconnections = 0` → same gaps at the proxy layer

For PDPL incident response (who accessed tenant data when), these settings are required.

### Actions

1. **Postgres ALTER SYSTEM × 3:**
   ```sql
   ALTER SYSTEM SET log_connections = on;
   ALTER SYSTEM SET log_disconnections = on;
   ALTER SYSTEM SET log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h ';
   SELECT pg_reload_conf();
   ```
2. **PgBouncer pgbouncer.ini** (`sed -i` on host path `/root/servix/tooling/docker/pgbouncer/pgbouncer.ini`):
   ```
   log_connections = 0  →  1
   log_disconnections = 0  →  1
   ```
3. **Persisted in `tooling/postgres/postgresql.conf`** (this commit) — replaces the placeholder `off` lines from A8-002 commit.

### Bind-mount inode bug (Tier rule 26 reapplied)

Edit-in-place `sed -i` on the host pgbouncer.ini broke the bind-mount inode (same pattern as A8-008 nginx). The container saw the OLD pgbouncer.ini (still `= 0`) even after SIGHUP. **Fix:** `docker compose up -d --force-recreate --no-deps pgbouncer` to re-attach the mount.

### Regression discovered during recreate: pgbouncer userlist regenerated to single-user state

The pgbouncer entrypoint (`/entrypoint.sh` in container) runs on every start:
```sh
echo "\"${PGBOUNCER_USER}\" \"${PGBOUNCER_PASSWORD}\"" > /etc/pgbouncer/userlist.txt
```

This **wipes** any users added at runtime (e.g., `servix_app` from A8-003) on every recreate. After A8-011's pgbouncer recreate, `servix_app` connections via pgbouncer returned `SASL authentication failed`. Restored by re-`docker cp`-ing a userlist.txt containing both `servix` and `servix_app` entries.

**Flag as `A8-IV-021`:** pgbouncer entrypoint must be patched to either (a) loop over `PGBOUNCER_USER*` env vars to support multiple users, or (b) rely on `auth_query` (already configured) for runtime user resolution — meaning the entrypoint should only set the bootstrap auth_user and let auth_query handle the rest. Until fixed, **every pgbouncer recreate breaks the app temporarily** until userlist is manually restored.

### Verification

Sample postgres log lines post-deploy (new format active):
```
2026-05-16 20:10:00 UTC [372195]: [1-1] user=[unknown],db=[unknown],app=[unknown],client=172.18.0.4 LOG:  connection received: host=172.18.0.4 port=60456
2026-05-16 20:10:00 UTC [372195]: [2-1] user=servix_app,db=servix_platform,app=[unknown],client=172.18.0.4 LOG:  connection authenticated: identity="servix_app" method=scram-sha-256
2026-05-16 20:10:00 UTC [372195]: [3-1] user=servix_app,db=servix_platform,app=[unknown],client=172.18.0.4 LOG:  connection authorized: user=servix_app database=servix_platform
```

Sample pgbouncer log lines:
```
2026-05-16 20:07:01.260 UTC [1] LOG C-0x... (nodb)/servix_app@172.18.0.6:37430 login attempt: db=servix_platform user=servix_app tls=no replication=no
```

| Test | Expected | Actual |
|---|---|---|
| `SHOW log_connections` | `on` | ✅ `on` (source: configuration file) |
| `SHOW log_disconnections` | `on` | ✅ `on` |
| `SHOW log_line_prefix` | new format | ✅ matches `'%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '` |
| pgbouncer.ini `log_connections` | `1` | ✅ (after recreate) |
| Fresh connection logs in postgres | yes | ✅ 3-line sequence per connection |
| pgbouncer login attempts logged | yes | ✅ |
| api-1/api-2 health post-pgbouncer-recreate | `db_status=ok` | ✅ |
| All containers | healthy | ✅ |

### Side observation (logged for owner)

`user=servix password authentication failed for user "servix"` from `172.18.0.9` appeared in postgres logs. Likely a container (evolution? backup? scheduled job?) that wasn't recreated after A8-IV-008 servix password rotation. Will reach steady state once that container restarts (or owner can force-recreate it).

### Backup files (rollback path)

- `/root/servix/tooling/docker/pgbouncer/pgbouncer.ini.bak-A8-011-20260516_220515`
- Postgres rollback: `ALTER SYSTEM RESET log_connections; ALTER SYSTEM RESET log_disconnections; ALTER SYSTEM RESET log_line_prefix; SELECT pg_reload_conf();`

### Followup tickets

- `A8-IV-019`: WAL archive script `/scripts/archive-wal.sh` is non-executable on prod → PITR broken. Discovered during A8-011 diagnostic. **NEXT card after A8-011 push.**
- `A8-IV-020`: docker `json-file` driver has no log rotation. With log_connections=on, postgres stderr volume increases. Prod `/var/lib/docker/containers/.../*-json.log` for postgres = 91MB now. Add `/etc/docker/daemon.json` with `max-size:100m max-file:5` during A8-009 maintenance window (requires `systemctl restart docker` = downtime).
- `A8-IV-021`: pgbouncer entrypoint regenerates userlist.txt to single-user state on every container start. Wipes `servix_app` (and any future runtime-added user). Patch entrypoint or remove userlist regeneration in favor of `auth_query`-only.

### A8-IV-019: PITR / WAL archive — emergency disk-pressure mitigation

- **Date:** 2026-05-16 (CEST)
- **Severity:** HIGH (disk-fill prevention) + tracking for full repair

### Discovery (during A8-011)

Postgres log showed repeated:
```
sh: /scripts/archive-wal.sh: Permission denied
archive command failed with exit code 126
```

Diagnostic revealed PITR pipeline was broken at **multiple layers**, not just one missing exec bit:

| Layer | State |
|---|---|
| `tooling/postgres/archive-wal.sh` mode | `100644` in git, `644 root:root` on host — **not executable** |
| `mc` binary in postgres container | **not installed** (postgres:17-alpine doesn't include it) |
| `gpg` binary in postgres container | **not installed** |
| `MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD` env in postgres container | **not set** |
| `BACKUP_ENCRYPTION_PASSPHRASE` env in postgres container | **not set** |
| MinIO bucket `servix-wal` | **does not exist** (only `servix-backups/` was created) |
| `archive_command` | `/scripts/archive-wal.sh "%p" "%f"` (calls script directly, requires exec bit) |

The script and `archive_command` were designed for a runtime environment that postgres:17-alpine does not provide. PITR has been broken since **2026-05-01 00:24 UTC** (≈16 days) — same date as the broader infra epoch (postgres + backup container creation).

### Critical operational pressure (this is what forced mitigation now)

`pg_wal/` had **3625 stuck `.ready` segments** = **56.7 GB**. At ~3.5 GB/day write rate (pre-launch traffic level), disk would fill in ~30 days. Owner decision: defer architectural fix (A8-IV-019b) but apply **immediate disk-pressure mitigation**.

### Quick mitigate (5-10 min, no postgres restart, reversible)

```sql
ALTER SYSTEM SET archive_command = '/bin/true';
SELECT pg_reload_conf();
CHECKPOINT;  -- triggers immediate archive_status sweep
```

Then second `CHECKPOINT` to recycle segments now marked `.done`.

### Results

| Metric | Before | After (60s) | Δ |
|---|---|---|---|
| `.ready` files | 3625 | 0 | -3625 |
| `.done` files | 0 | swept | (recycled by 2nd checkpoint) |
| pg_wal segments | 3626 | 89 | -3537 |
| pg_wal size | 56.7 GB | 1.4 GB | **-55.3 GB** |
| `/dev/sda1` used | 84 GB (44%) | 29 GB (15%) | **-55 GB** |
| postgres state | running|healthy | running|healthy | unchanged |
| restarts | 0 | 0 | unchanged |

### Trade-off

- **PITR is now formally disabled** (`archive_command=/bin/true` is a no-op that always returns success). However, PITR was already non-functional for 16 days due to the broken script. The change formalizes the broken state and frees disk.
- **Logical backups still work** (A8-001 servix-backup container ships full pg_dump per database every 6h to MinIO `servix-backups/` bucket). Recovery point = at most 6 hours of data loss vs the design intent of ~60s WAL-archive RPO.

### NOT persisted to repo `postgresql.conf`

`archive_command = '/bin/true'` is a **prod-only temporary measure** living in `postgresql.auto.conf` on prod. The repo `tooling/postgres/postgresql.conf` retains the original (correct) `archive_command = '/scripts/archive-wal.sh "%p" "%f"'` because:

1. The repo represents the design intent (PITR enabled with WAL shipping).
2. Persisting the `/bin/true` workaround in git would normalize the broken state and risk future rebuilds adopting it permanently.
3. A8-IV-019b will fix the actual problem; when fixed, prod's `postgresql.auto.conf` will be reset (or this line removed) to fall back to the repo value.

### Rollback (when A8-IV-019b ships)

```sql
ALTER SYSTEM RESET archive_command;  -- falls back to postgresql.conf value
SELECT pg_reload_conf();
```

### Followup tickets

- **`A8-IV-019b`** (architectural, HIGH priority — schedule before launch):
  PITR pipeline redesign. Choose one of:
  - **Option B**: install `mc` + `gpg` in postgres container (via custom Dockerfile or initContainer-style script), add MinIO/passphrase env vars to postgres service in compose, chmod 755 the script, recreate postgres (~15-30s downtime).
  - **Option C**: sidecar pattern — postgres writes WAL to a shared volume, `wal-shipper` sidecar container (with mc+gpg pre-installed) watches the volume and uploads to MinIO. Cleaner separation of concerns. Requires compose redesign + new service definition.

  Pre-condition for any option: create MinIO bucket `servix-wal` first.

### A8-IV-002 (followup): platform-admin tenant diagnostic results

- Tenant row: `cde3a2d9-...`, slug `platform-admin`, `database_name=platform_admin_db`, `status=active`, created 2026-04-09 11:11 UTC, no `pending_deletion_at`
- 1 user linked (presumably `admin@servi-x.com`, last login 2026-05-13 01:43 UTC — successful)
- 0 subscriptions, 0 invoices
- 1 audit log entry total: `trigger_backup` action on 2026-04-16 by user `f49e98ae-...`
- **Database `platform_admin_db` does not exist** in `pg_database` (verified via `SELECT datname FROM pg_database`)
- **Conclusion:** Reserved super-admin slug pattern. `admin@servi-x.com` logged in successfully on 2026-05-13, suggesting the super-admin code path bypasses `TenantMiddleware`'s per-tenant DB resolution. Safe to leave the row alone.
- **Decision:** No action this session. Tracked as `A8-IV-007` for proper investigation (does the super-admin login path actually skip per-tenant DB? Should `database_name` be `NULL` instead of a phantom DB name? What happens if a non-super-admin user is accidentally linked to `platform-admin` tenant?).

---

## 2026-05-17 — Session 2 begins

### A8-009 — timezone change Europe/Berlin → Asia/Riyadh

**Why:** SERVIX is a Saudi-market SaaS; all audit/booking timestamps should display KSA wall-clock to operators. Host was on `Europe/Berlin` and Postgres on `UTC` — both wrong for the business.

**Phase A — host + Postgres (tier 🔴, single owner pause):**

```
sudo timedatectl set-timezone Asia/Riyadh                      # host → +03
docker exec servix-postgres psql -U servix -d postgres -c
  "ALTER SYSTEM SET timezone TO 'Asia/Riyadh';"
docker exec servix-postgres psql -U servix -d postgres -c
  "ALTER SYSTEM SET log_timezone TO 'Asia/Riyadh';"
docker exec servix-postgres psql -U servix -d postgres -tAc
  "SELECT pg_reload_conf();"
```

Verified: `SHOW timezone` = Asia/Riyadh, `SHOW log_timezone` = Asia/Riyadh, `SELECT now()` = `2026-05-16 23:51:11.384954+03`. No replication lag (no replica running).

**Phase B — compose TZ env on 10 production-path services (tier 🟡 reversible):**

Added `TZ: Asia/Riyadh` to `environment:` blocks for: `postgres`, `pgbouncer`, `vault`, `api-1`, `api-2`, `dashboard`, `booking`, `admin`, `landing`, `nginx`. Skipped:
- `backup` — owner direction (cron schedule would shift 2h)
- `postgres-replica` — not running
- monitoring stack (prometheus/grafana/alertmanager/exporters) — UTC is standard for metrics correlation
- `evolution-api` — Brazil locale (its existing `TZ=America/Sao_Paulo` is intentional)
- `n8n` — already had `GENERIC_TIMEZONE=Asia/Riyadh`, plus not currently running on prod (per A8-008 cleanup)

Rolling `up -d --force-recreate --no-deps <svc>` per service. All 10 containers recreated cleanly; api-1 healthy in 10s, api-2 in 15s.

**Verification:**

| Container | `date` cmd | `TZ` env | Notes |
|---|---|---|---|
| postgres | +03 ✓ | set ✓ | tzdata installed on alpine |
| vault, nginx | +03 ✓ | set ✓ | tzdata installed |
| pgbouncer | UTC | set ✓ | libc tzdata missing → IV-022 |
| api-1, api-2 | UTC | set ✓ | Node ICU shows +03 — verified via `new Date()` |
| dashboard/booking/admin/landing | UTC | set ✓ | same as api — Node ICU works |

Node verification:
```
node -e 'console.log(new Date().toString())'
→ "Sat May 16 2026 23:59:54 GMT+0300 (Arabian Standard Time)"
```

**@Cron decorator audit:** No `@Cron` decorators in `apps/api/src/**`. Only one `@Interval(120_000)` in `order-expiry.service.ts:20`; intervals are relative and TZ-agnostic. **A8-IV-022 (cron TZ assumption) closed — not applicable.**

### Followup tickets

- **`A8-IV-023`** (LOW): `pgbouncer`, `api-*`, `dashboard`, `booking`, `admin`, `landing` containers lack `tzdata` package — `date` command falls back to UTC despite `TZ=Asia/Riyadh` env. Node.js apps unaffected (V8 ICU embedded). PgBouncer log timestamps will show UTC. Fix: add `apk add --no-cache tzdata` to relevant Dockerfiles. Not blocking launch — JSON loggers use `Date.toISOString()` (always UTC by spec, correct for log aggregation).

- **`A8-IV-024`** (MEDIUM): repo `tooling/docker/docker-compose.prod.yml` is drifted from prod `/root/servix/tooling/docker/docker-compose.prod.yml`. Prod has removed `n8n` + `gemini-proxy` + `evolution-api` service blocks (A8-008 cleanup) and lost inline A8-003/A8-004 comments. Either backfill prod from repo (re-add the comments and decide on n8n) or strip the removed blocks from the repo. Filed as drift in case session 1's cherry-pick missed a propagation step.


### V-27 — Terraform `deploy_ip` insecure default

**Why:** `tooling/terraform/variables.tf` declared `default = "0.0.0.0/0"` for `deploy_ip`. Any `terraform apply` run without `TF_VAR_deploy_ip` (or a tfvars override) would silently open SSH/Grafana/Jaeger to the entire internet. CI passes `secrets.DEPLOY_IP` via `TF_VAR_deploy_ip` already, so the default was masked in normal use — but an ad-hoc local apply would not be.

**Change:**
- Removed `default = "0.0.0.0/0"` from `variable "deploy_ip"` (now required).
- Added `validation { condition = can(cidrhost(var.deploy_ip, 0)) && var.deploy_ip != "0.0.0.0/0" && var.deploy_ip != "::/0" }` to reject open-world ranges at plan time with a clear error message.

`firewall.tf` uses `var.deploy_ip` in 3 SSH/Grafana/Jaeger ingress rules — none of which should ever accept `0.0.0.0/0`. CI workflow already supplies `secrets.DEPLOY_IP`, so the next `terraform plan` should succeed unchanged.

**Rollback:** restore the `default` line if a CI run breaks (would indicate the secret was never wired up — investigate before reverting).


### A8-IV-025 — pgbouncer auth delegation for NOSUPERUSER app role (P0, blocking V-30)

**Discovered during V-30 smoke testing.** Found that `/auth/login` triggered `prisma:error: FATAL: SASL authentication failed` even though `servix_app` could authenticate directly against postgres. Root cause: A8-003 (session 1) made `servix_app` NOSUPERUSER but did not add a corresponding `auth_user = <superuser>` line to `pgbouncer.ini`. Pgbouncer's `auth_query = SELECT usename, passwd FROM pg_shadow WHERE usename=$1` requires SUPERUSER to read `pg_shadow`. Without `auth_user` set, pgbouncer used the client's own creds (servix_app, NOSUPERUSER) for the lookup → SASL fail → entire prod DB path broken since 2026-05-15. Undetected because prod was idle and the `/health/live` probe doesn't touch the DB.

**Fix:** added `auth_user = servix` directly under `auth_query` in `tooling/docker/pgbouncer/pgbouncer.ini`. Pgbouncer now uses the superuser's creds (already in `userlist.txt` via the entrypoint) to run the auth_query and returns the SCRAM hash for the requested user.

**Verification after pgbouncer + api-1 + api-2 force-recreate:**

| Probe | Result |
|---|---|
| `psql -h pgbouncer -U servix_app` | `current_user=servix_app, is_superuser=off` ✓ |
| `/api/v1/health` | `status=healthy, database=ok, responseTime=9ms` ✓ |
| `/api/v1/auth/login` (bad creds) | `HTTP 400 VALIDATION_ERROR` (not 500) ✓ |
| api-1 / api-2 logs | clean — no prisma error after recreate ✓ |

**Rollback:** revert `tooling/docker/pgbouncer/pgbouncer.ini` and recreate `pgbouncer`. DB will go back to broken state.


### V-29 + V-30 — `.env.example` sanitization + JWT/ENCRYPTION_KEY Joi hardening + prod secret rotation

**Why:** `.env.example` files held predictable placeholders (`servix_secret`, `change-me-in-production-*`, `CHANGE_ME_*`) — a copy-paste deploy could ship with them intact. Joi only checked `JWT_*_SECRET` for non-empty existence — no length, no placeholder rejection. ENCRYPTION_KEY required `min(32)` in production despite using AES-256 (need 32 *bytes* = 64 hex chars).

**Code changes:**

| File | Change |
|---|---|
| `apps/api/src/shared/config/env.validation.ts` | `JWT_ACCESS_SECRET` + `JWT_REFRESH_SECRET`: `min(64)` + pattern reject `<REQUIRED` / `change-me`. `ENCRYPTION_KEY` (production): bumped `min(32)` → `min(64)` + same pattern reject |
| `apps/api/src/shared/config/jwt.config.ts` | Fallback `'24h'` → `'15m'` (was the only `24h` reference; everywhere else already used `15m`) |
| `.env.example` (root) | Replaced 10 predictable secret values with `<REQUIRED_NO_DEFAULT>` |
| `apps/api/.env.example` | Same treatment — 5 placeholders |
| `tooling/docker/.env.example` | Same treatment — 9 `CHANGE_ME_*` → `<REQUIRED_NO_DEFAULT>` with helpful `openssl rand ...` comments |

**Prod secret rotation (sub-task, owner-approved during scope-discovery):**

Discovered prod `.env` had:
- `JWT_ACCESS_SECRET` = 37 chars (would fail new `min(64)`)
- `JWT_REFRESH_SECRET` = 38 chars (would fail)
- `ENCRYPTION_KEY` = 64 chars (already passes)

Rotated `JWT_ACCESS_SECRET` + `JWT_REFRESH_SECRET` server-side via `openssl rand -base64 64 | tr -d "\n=" | head -c 80` → both now 80 chars, base64-alphabet, no placeholder patterns. Backup `.env.bak-V-30-20260517_001520` preserved (owner: capture both to Bitwarden via `sudo grep -E '^JWT_(ACCESS|REFRESH)_SECRET=' /root/servix/tooling/docker/.env`, then `shred -u` the backup).

Recreated `api-1` + `api-2` (force-recreate, no-deps). Both healthy in ≤16s. After A8-IV-025 pgbouncer fix (same session), `/api/v1/health` returned `status=healthy, database=ok, 9ms`; `/api/v1/auth/login` returned `HTTP 400 VALIDATION_ERROR` (not 500) — JWT module loaded, DB queried, auth flow intact.

**Verification of Joi changes (in-isolation regex check):**

| Input | Pattern match | Expected |
|---|---|---|
| `<REQUIRED_NO_DEFAULT>` | yes | reject ✓ |
| `change-me-prod` | yes | reject ✓ |
| `CHANGE_ME_strong_pw` | yes | reject ✓ |
| `Change-Me` / `change me now` / `changeme` | yes | reject ✓ |
| random 80-char base64 | no | accept ✓ |

`pnpm tsc --noEmit` clean on apps/api.

**Rollback:** revert the 5 files. Prod `.env` retains the rotated 80-char secrets even if code reverted (old shorter values are not restored automatically — that's intentional, the rotation is a one-way upgrade).


### A8-IV-024 — n8n stack cleanup (compose + .env.example)

**Why:** n8n was removed from prod during A8-008 (session 1) but the repo still had the full `n8n:`, `gemini-proxy:` (n8n relay), `n8n_data:` named volume, and three `N8N_*` env entries — repo↔prod drift filed earlier as IV-024. Apps don't reference n8n anywhere: `grep -rIn 'n8n\|N8N' apps/api/src` → 0 matches, so no application-code coupling.

**Changes:**

| File | Change |
|---|---|
| `tooling/docker/docker-compose.prod.yml` | Removed `n8n:` service block (38 lines), `gemini-proxy:` service block (10 lines — sole purpose was relaying for n8n), `n8n_data:` named volume entry. Reworded `evolution-api` section header from "WhatsApp gateway for n8n workflows" → "WhatsApp gateway for SERVIX API" (Evolution is used directly by the API via CircuitBreakerService) |
| `.env.example` (root) | Removed n8n section (header + 3 vars: `N8N_BASIC_AUTH_USER`, `N8N_BASIC_AUTH_PASSWORD`, `N8N_ENCRYPTION_KEY`). Reworded Evolution section header to drop n8n reference |

**Out of scope (owner-confirmed):**
- `tooling/n8n/workflows/*.json` — n8n workflow definitions; preserved as reference / future-import
- `apps/api/scratch/n8n-local.yml` — dev scratch file, not deployed
- Cloudflare DNS `n8n.servi-x.com` — owner handling from CF panel

**Verification:**
- `docker compose -f tooling/docker/docker-compose.prod.yml config` parses without n8n/gemini-proxy entries (env var warnings only — no structural errors)
- `grep -inE 'n8n|N8N_' tooling/docker/docker-compose.prod.yml .env.example tooling/docker/.env.example apps/api/.env.example` → 0 matches
- Prod state already matches: `docker volume ls` shows no n8n volume, `pg_database` shows no `n8n_db` (presumably dropped in A8-008)

**Followup tickets:**

- **`A8-IV-027`** (LOW): prod `/root/servix/tooling/docker/.env` carries 6 orphan N8N entries (3 unique keys duplicated on lines 73-75 *and* 83-85). No container consumes them now. Owner: remove via `sudo sed -i '/^N8N_/d' /root/servix/tooling/docker/.env` after capturing the values to Bitwarden in case n8n is ever re-introduced. The duplicate lines are themselves suspicious — likely fallout from two separate copy-paste sessions during initial setup; worth investigating other duplicated entries.


### V-31 — re-enable security gates in CI (`pnpm audit` + Semgrep)

**Why:** `.github/workflows/ci.yml` had `continue-on-error: true` on both the `pnpm audit` and Semgrep steps — i.e., neither step could fail the build. The CICD doc claimed they were blocking gates; they were not.

**Changes (`ci.yml § security` job):**

| Step | Before | After |
|---|---|---|
| `pnpm audit` | `pnpm audit --audit-level=critical` + `continue-on-error: true` | `pnpm audit --prod --audit-level=critical` (no continue-on-error). `--prod` scopes to runtime deps — high-severity findings in dev-only transitive packages (handlebars/picomatch/lodash) no longer gate releases |
| Semgrep | `semgrep/semgrep-action@v1` + `continue-on-error: true` | Direct CLI via `returntocorp/semgrep:latest` image with `--severity=ERROR --error` flags. Makes the contract explicit (no action wrapping to read flags from) |

**Sanity:**
- `pnpm audit --prod --audit-level=critical` locally: `0 critical` (48 vulns: 4 low / 26 moderate / 18 high — all low/moderate/high pass the `--audit-level=critical` gate). Exit 0.
- ci.yml otherwise unchanged; the `Coverage Report` step at line 96 keeps its `continue-on-error: true` because it's informational logging, not a gate.

**Rollback:** restore `continue-on-error: true` on the two steps. The audit/Semgrep findings will continue to run and report, just without blocking merge.


### A8-IV-029 / A8-IV-030 / A8-IV-031 — clear V-31 CI gate

V-31 re-enabled `pnpm audit` + Semgrep as blocking gates. The first PR run surfaced 2 Semgrep ERROR-level findings and 1 ESLint error — all genuine, none suppression-worthy:

| Ticket | File | Fix |
|---|---|---|
| **A8-IV-029** | `apps/api/src/shared/encryption/encryption.service.ts:93` | `createDecipheriv(algorithm, key, iv)` → `createDecipheriv(algorithm, key, iv, { authTagLength: 16 })`. GCM forgery hardening — `encrypt()` emits 16-byte tags via Node default `getAuthTag()`, so the decrypt side must enforce the same length. Encryption test suite still 11/11 green (round-trip / unicode / tamper). Semgrep rule `javascript.node-crypto.security.gcm-no-tag-length` |
| **A8-IV-030** | `.github/workflows/release.yml:32` | Moved `${{ github.event.inputs.tag \|\| github.ref_name }}` out of `run:` body into an `env:` block (`INPUT_TAG`, `REF_NAME`), then `TAG="${INPUT_TAG:-$REF_NAME}"` inside the script. `workflow_dispatch` inputs are attacker-controlled; the `${{ … }}` inline-template would let a crafted tag break out of the shell. Semgrep rule `yaml.github-actions.security.run-shell-injection` |
| **A8-IV-031** | `apps/api/src/modules/zatca/zatca-crypto.service.spec.ts:189` | `const { createHash } = require('crypto')` → top-level `import { createHash } from 'crypto'`. `@typescript-eslint/no-require-imports` blocker. zatca-crypto test suite still 13/13 green |

**Pre-existing CI debt filed separately:**

- **`A8-IV-028`**:
  - GitHub `Dependency review` check fails with "Dependency graph is not supported on this repository" — owner enables in Settings → Code security & analysis → Dependency graph (single click).
  - `Terraform Plan` check fails because `secrets.CLOUDFLARE_API_TOKEN` is empty in PR context (empty string fails the Cloudflare provider's regex). The V-27 validation correctly fires on the same run because `secrets.DEPLOY_IP` is also empty — both upstream of V-31. Owner action: wire secrets into PR jobs (or scope the Terraform job to push events only).

**Pre-push verification:**
- `pnpm --filter @servix/api exec jest src/shared/encryption/encryption.service.spec.ts` — 11/11 pass
- `pnpm --filter @servix/api exec jest src/modules/zatca/zatca-crypto.service.spec.ts` — 13/13 pass
- `pnpm --filter @servix/api lint` — 0 errors (5 unused-var warnings remain, pre-existing, do not block)
- `pnpm --filter @servix/api exec tsc --noEmit` — clean


### A8-010 — secrets cleanup + servix-old archive destruction

**Pivot from rotation to deletion** (owner call): the AI Reception strategy is moving off LLMs entirely (Library + Tone + WhatsApp Flows path, no Gemini/Cloudflare AI/OpenAI). Rotating credentials that are scheduled for deletion in 9-10 weeks via Engineer 4b's CARD-AI-001..005 is wasted effort. Delete dead keys from `.env` + shred the at-rest plaintext copies in archives.

**Actions:**

1. **Prod `/root/servix/tooling/docker/.env` keys deleted:**
   - `GEMINI_API_KEY` (39 chars, dead per AI strategy)
   - `GEMINI_BASE_URL` (58 chars, orphan — not in compose env list, code uses default)
   - `CLOUDFLARE_AI_TOKEN` (53 chars, dead)
   - `OPENAI_API_KEY` (164 chars, GPT-mini migration deferred)
   Backup: `.env.bak-A8-010-20260517_010705`. `.env` shrank 3729 → 3378 bytes.

2. **WHATSAPP_REGISTRATION_PIN generated** server-side (6-digit, was missing) — Phase 1 owner contribution.

3. **api-1 + api-2 recreated** (`force-recreate --no-deps`). Both healthy in 15s. Boot logs show expected `⚠️ No AI provider configured` warns from `GeminiService` and `AIProviderService` — these are the active fallback paths and will be removed by Engineer 4b. `/health = status=healthy, database=ok, 60ms`; `/auth/login = HTTP 400 VALIDATION_ERROR`.

4. **Retained secrets** (still active): `EVOLUTION_API_KEY`, `META_APP_SECRET`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, `WHATSAPP_REGISTRATION_PIN`, `MINIO_ROOT_USER`/`PASSWORD` (= `S3_ACCESS_KEY`/`SECRET_KEY`; verified SAME via equality check), `JWT_*_SECRET`, `ENCRYPTION_KEY`, `POSTGRES_PASSWORD`, `REDIS_PASSWORD`. None rotated this card.

5. **Phase 3 destruction (`shred -u -z -n 3` + `rm -rf`):**

   | File class | Count |
   |---|---|
   | `.env` / `.env.example` plaintext | 8 |
   | RSA private key (`origin.key` — Cloudflare Origin TLS, same as prod live cert; rotation deferred to A8-IV-032) | 1 |
   | PII DB dumps (platform 80 KB + tenant 158 KB + Evolution WhatsApp DB) | 3 |
   | Tarballs containing nested `.env`/`origin.key` | 1 |

   Then `rm -rf /root/servix-old /root/servix-pre-deploy-backup`. Verified zero remnants via `find /root -maxdepth 3 -type f \( -name '*.dump' -o -name 'origin.key' \)` (excluding active `/root/servix/`). Disk freed ~8 GB.

**Note for owner — Bitwarden hygiene:** Run `ssh servix-admin@... "sudo grep '^WHATSAPP_REGISTRATION_PIN=' /root/servix/tooling/docker/.env"` once to capture the new PIN to Bitwarden, then clear the local clipboard/terminal.

### Followup tickets

- **`A8-IV-032`** (P2, deferred): Cloudflare Origin TLS cert rotation. Current `origin.key` lives only in `/root/servix/tooling/docker/nginx/ssl/origin.key` after this card's shred — Cloudflare panel must issue a fresh origin cert next time risk budget allows.

- **`A8-IV-033`** (**HIGH** — owner-action, blocks any future merge to main):
  Repo↔prod **3-way fork** discovered during A8-010 cleanup.
  - `origin/main` @ `b5452d2` — stale, 27 commits behind prod's running code.
  - `feature/ai-reception-phases-1-8` @ `5c4f44c` — **running on prod** (uncommitted: my session-2 in-place edits to `docker-compose.prod.yml` + `pgbouncer.ini`). Diff vs `origin/main`: **214 files / +28,214 / −4,313**. Includes the AI Reception module, POS hardening (manager override + held bills), Compliance module, new `ai-provider.service.ts`, WhatsApp Evolution rewrite, and the n8n+gemini-proxy removal that I duplicated in `A8-IV-024`.
  - `chore/e8-prod-hardening` — Engineer 1 work, off old `main`, unaware of the feature branch.
  - **Owner-recommended path:** cherry-pick `chore/e8-prod-hardening` commits onto `feature/ai-reception-phases-1-8`, then PR that branch (now containing both bodies of work) to `main`.
  - **CLAUDE.md correction needed:** "deploys always come from main HEAD" is currently false — prod images were `docker compose build`'d directly from `/root/servix` while checked out on the feature branch.
  - Target resolution: within 1 week; not blocking session 2 wrap-up.


### A8-013 + A8-006 + A8-014 — nginx allowlists + Next.js header hygiene (batched)

Three audit findings in the same `nginx.conf` + `next.config.ts` domain, bundled into one commit per session-2 batching rule.

**A8-006 — Prometheus `/metrics` was exposed to the internet:**

Pre-fix `nginx.conf` had `location /metrics { ... }` which was **dead code** — the API serves metrics on `/api/v1/metrics` (global prefix `api` + URI versioning `v1` + `@Controller('metrics')`), not on `/metrics`. The dead block matched nothing. The actual `/api/v1/metrics` requests fell through to `location /` (general API) and returned 200 with full Prometheus output to anyone on the internet.

Replaced with:
```nginx
location = /api/v1/metrics {
  allow 172.18.0.0/16;
  deny all;
  proxy_pass http://api_servers;
  proxy_set_header Host $host;
}
```

**A8-013 — `/api/v1/health/detailed` exposed CPU/mem/disk/uptime:**

Added a matching exact-match block immediately after the metrics block:
```nginx
location = /api/v1/health/detailed {
  allow 172.18.0.0/16;
  deny all;
  proxy_pass http://api_servers;
  proxy_set_header Host $host;
}
```

Basic `/api/v1/health` (returns `status=healthy`, `database=ok`, response time only — no resource numbers) stays public via the general `location /`.

**A8-014 — Next.js `poweredByHeader` + duplicate security headers:**

| App | Change |
|---|---|
| `apps/dashboard/next.config.ts` | `poweredByHeader: false` + removed `X-Content-Type-Options`/`X-Frame-Options`/`X-XSS-Protection`/`Referrer-Policy` from `headers()` (already set globally by nginx) |
| `apps/admin/next.config.ts` | same |
| `apps/booking/next.config.ts` | same |
| `apps/landing/next.config.ts` | `poweredByHeader: false` (no duplicate headers to clean) |

The duplicate caused browsers on `app.servi-x.com` to see **two** `X-Frame-Options` headers: `DENY` from Next.js and `SAMEORIGIN` from nginx — undefined-per-spec behavior, easy for an attacker to fingerprint.

**Verification (post-nginx-reload on prod):**

| Probe | Result |
|---|---|
| `curl https://api.servi-x.com/api/v1/metrics` (external) | **HTTP 403** ✓ |
| `curl https://api.servi-x.com/api/v1/health/detailed` (external) | **HTTP 403** ✓ |
| `curl https://api.servi-x.com/api/v1/health` (external) | HTTP 200 ✓ |
| `docker exec servix-postgres curl http://api-1:4000/api/v1/metrics` (internal direct) | HTTP 200 ✓ (Prometheus path unaffected) |
| `docker exec servix-nginx nginx -t` + `nginx -s reload` | clean ✓ |
| `pnpm tsc --noEmit` across all 4 Next apps | clean ✓ |

Backup: `/root/servix/tooling/docker/nginx/nginx.conf.bak-A8-013-014-20260517_190211`.

**Important caveat:** Next.js `poweredByHeader: false` and the duplicate-header removal only take effect on **next image rebuild**. The currently running dashboard/admin/booking/landing containers were built before this commit and continue to emit the old headers. Next deploy from this branch (or whenever Engineer-1's branch merges) will pick them up.

### Followup ticket

- **`A8-IV-034`** (P3): `tooling/prometheus/prometheus.yml` has `metrics_path: '/metrics'` but the API endpoint is `/api/v1/metrics`. Prometheus has been scraping a 404; the `servix-api` job has been silently dead. Fix: update to `metrics_path: '/api/v1/metrics'`, then verify Prometheus targets page shows the job as UP and metrics ingestion resumes. Likely the cause of any "no API metrics in Grafana" surprises.


### A8-015 — Postgres TLS enabled + pg_hba tightened to docker bridge

**Pre-fix state:**
- `ssl = off` (no transport encryption between any DB client and postgres).
- `pg_hba.conf` ended with `host all all all scram-sha-256` — any IP could attempt scram auth.

**Change:**

1. **Self-signed cert** (RSA-4096, 10y validity, `CN=servix-postgres`, SAN `DNS:postgres,DNS:servix-postgres,DNS:localhost,IP:127.0.0.1`) generated on the prod host with `openssl req`. Copied into the postgres container's data dir as `server.crt` / `server.key` (mode 600, owner `postgres:postgres`). Host backup at `/etc/servix/postgres/` (root:root, key mode 600).

2. **`tooling/postgres/postgresql.conf`** — added 4 lines under `# ── Connection / auth ──`:
   ```
   ssl = on
   ssl_cert_file = 'server.crt'
   ssl_key_file = 'server.key'
   ssl_min_protocol_version = 'TLSv1.2'
   ```
   Backup: `.bak-A8-015-<ts>`. Host bind-mount means the container sees the change on next reload.

3. **`/var/lib/postgresql/data/pg_hba.conf`** (container) — last rule narrowed:
   - **Before:** `host all all all scram-sha-256`
   - **After:** `host all all 172.18.0.0/16 scram-sha-256`
   Backup `.bak-A8-015-<ts>` (also in-container). Local-socket + 127.0.0.1 + replication rules unchanged.

4. **Reload via `pg_reload_conf()`** — all 4 SSL params + pg_hba are `sighup` context, so no restart was required. Log confirmed `received SIGHUP, parameter "ssl" changed to "on"`.

**Verification:**

| Probe | Result |
|---|---|
| `SHOW ssl` | `on` |
| `SHOW ssl_min_protocol_version` | `TLSv1.2` |
| `pgbouncer → postgres` as `servix_app` (SCRAM) | works ✓ |
| `/api/v1/health` | `status=healthy, database=ok, 10ms` |
| postgres log | clean `SIGHUP` + ssl-changed-to-on lines |

**Important note on current SSL utilization:**

`pg_stat_ssl` shows **0 SSL / 22 plain** connections. The SSL listener is active but no clients negotiate SSL today:
- Existing connections were established before the reload — they don't auto-upgrade.
- pgbouncer (1.x) doesn't bridge client→server TLS by default; `server_tls_sslmode` would need to be set in `pgbouncer.ini`.
- `PLATFORM_DATABASE_URL` / `DATABASE_READ_URL` env vars don't set `sslmode=require`.

So A8-015 satisfies the audit's "enable SSL internally + tighten pg_hba" but **doesn't yet force clients to use TLS**. That's A8-IV-037 below.

**Followup tickets (all pre-existing, discovered during reload verify):**

- **`A8-IV-035`** (P2): `servix-postgres-exporter` (container 172.18.0.9) has stale `servix` superuser credentials in `DATA_SOURCE_NAME` — has been spamming `FATAL: password authentication failed for user "servix"` since the A8-IV-008 rotation. Switch to `servix_app` with a fresh password and append `sslmode=require` to the URI.

- **`A8-IV-036`** (P3): repeating `FATAL: database "servix" does not exist` from `client=[local]`. Some internal probe (likely a healthcheck or backup helper) connects to a database literally called `servix` instead of `servix_platform`. Identify and correct.

- **`A8-IV-037`** (P3): force TLS on all DB clients now that the listener is active. Two changes:
  1. Append `?sslmode=require` to `PLATFORM_DATABASE_URL` + `DATABASE_READ_URL` in `tooling/docker/docker-compose.prod.yml` (and update `.env.example` accordingly).
  2. Set `server_tls_sslmode = verify-ca` (or at least `require`) + `server_tls_ca_file` in `pgbouncer.ini` so pgbouncer→postgres also uses TLS.

