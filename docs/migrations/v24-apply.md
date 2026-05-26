# V-24 / A2-08 — Admin reset link hashing runbook

**Severity:** HIGH (P1) — admin-issued reset tokens stored plaintext + logged to stdout.
**Author:** Engineer 2 (Auth/Identity).
**Created:** 2026-05-26.
**Audit source:** `docs/principal-audit/synthesis-2026-05-14.md` V-24 / A2-08.
**Commit:** single — see `git log --oneline -1`.

## What this card does

Pre-V-24, `admin.service.sendPasswordResetLink` had three distinct gaps in one method:

| Gap | Pre-V-24 | Threat |
|---|---|---|
| 1. Stored raw token in DB | `passwordReset.create({ data: { token: randomBytes(32).toString('hex') } })` | Anyone with DB read access (or a backup) has every active admin-reset token. |
| 2. Logged raw token to stdout | `console.log(\`[AdminResetLink] User \${user.email} → token: \${token}\`)` | Anyone with log access (SSH, journald, Loki forwarders) sees the token. |
| 3. Admin path stored RAW; self-serve verifier hashed and looked up by HASH | (silent mismatch) | The admin-issued link was un-redeemable end-to-end via `/auth/reset-password`. |

After V-24:

- `sendPasswordResetLink` generates the raw 32-byte hex token, SHA-256 hashes it, persists ONLY the hash in `password_resets.token` (the column was already `VARCHAR(64)` matching sha256 hex width — no schema change).
- The raw token is returned in the API response body for the admin to deliver manually. **Email wiring tracked as V-24-email follow-up** (requires `MailService` injection into `AdminModule`).
- The `console.log` is deleted entirely.
- The audit action is renamed `admin_send_reset_link` → `admin_password_reset_link_sent` for naming consistency. `newValues` is enriched with `expiresAt` (ISO timestamp) and `tokenHashPrefix` (first 8 chars of the hash; 2^32 collision space — enough for forensic correlation, not enough to brute-force the preimage back to the raw token).
- The incidental correctness bug is fixed: the existing `auth.service.resetPassword` verifier already hashes the submitted token and looks up by hash; once the admin path stores the hash, the same verifier serves both flows. No changes to `auth.service.resetPassword`.

## Deploy posture

**Pure runtime card.** No platform or tenant migration. No new dependency. Standard rolling deploy:

```bash
ssh servix-admin@194.163.158.70 << 'EOF'
  set -euo pipefail
  cd /home/servix-admin/servix
  sudo docker compose -f tooling/docker/docker-compose.prod.yml pull api-1 api-2
  sudo docker compose -f tooling/docker/docker-compose.prod.yml up -d --force-recreate --no-deps api-1
  sleep 10
  curl -fsS https://api.servi-x.com/api/v1/health | head -2
  sudo docker compose -f tooling/docker/docker-compose.prod.yml up -d --force-recreate --no-deps api-2
EOF
```

## Breaking change scope

**Response shape change:** `POST /api/v1/admin/users/:id/send-reset-link` now returns `{ message, token, expiresAt }` instead of `{ message }` only. The new fields are additive. No frontend currently consumes this endpoint, so no callers break.

**Audit action rename:** `admin_send_reset_link` → `admin_password_reset_link_sent`. The `platformAuditLog.action` column is `VARCHAR(50)` and stores the literal action name. Any downstream consumer (Grafana dashboards, ops Slack queries, BI) querying for the old name will start missing the new rows. No such consumer was found in:
```
$ grep -rn "admin_send_reset_link" apps/ docs/
apps/api/src/core/admin/admin.service.ts  ← only the (now-renamed) emitter
apps/api/dist/...                         ← stale build artifact
```
Old rows in `platform_audit_logs` keep their original action string. A backfill `UPDATE` to rename historical rows would be cosmetic; skip it.

**Existing pre-V-24 `password_resets` rows:** any row created by the pre-V-24 admin path holds a raw 64-char token in `token`. These rows were already un-redeemable (bug #3 above), so users couldn't have completed a reset via them. They expire naturally within 1 hour. No cleanup migration.

## Post-deploy smoke

```bash
# 1. Login as super_admin to get an access token.
ADMIN_TOKEN=$(curl -fsS -X POST https://api.servi-x.com/api/v1/admin/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"<super_admin email>","password":"<...>"}' | jq -r '.accessToken')

# 2. Issue a reset link for a target user.
TARGET_USER_ID=<existing user UUID>
RESET_RESPONSE=$(curl -fsS -X POST https://api.servi-x.com/api/v1/admin/users/$TARGET_USER_ID/send-reset-link \
  -H "Authorization: Bearer $ADMIN_TOKEN")
echo "$RESET_RESPONSE" | jq .
# expected:
#   { "message": "...سلّم الرابط يدوياً.", "token": "<64 hex chars>", "expiresAt": "..." }

RAW_TOKEN=$(echo "$RESET_RESPONSE" | jq -r '.token')

# 3. Verify the DB has the HASH (not the raw):
sudo docker exec -i servix-postgres psql -U servix -d servix_platform <<SQL
  SELECT id, user_id, length(token), used_at, expires_at
  FROM password_resets
  ORDER BY created_at DESC LIMIT 1;
  -- length(token) should be 64; token value should be the sha256 hex, NOT the raw.
SQL

# 4. Verify the audit row carries prefix only, not the full hash or raw:
sudo docker exec -i servix-postgres psql -U servix -d servix_platform <<SQL
  SELECT action, new_values->>'tokenHashPrefix', length(new_values->>'tokenHashPrefix'),
         new_values->>'sentTo', new_values->>'expiresAt'
  FROM platform_audit_logs
  WHERE action = 'admin_password_reset_link_sent'
  ORDER BY created_at DESC LIMIT 1;
  -- length should be 8. Full hash and raw must NOT appear anywhere in new_values.
SQL

# 5. End-to-end: redeem the raw token via the self-serve endpoint.
curl -fsS -X POST https://api.servi-x.com/api/v1/auth/reset-password \
  -H 'Content-Type: application/json' \
  -d "{\"token\":\"$RAW_TOKEN\",\"password\":\"NewStrongPass1!\"}"
# expected: 200 + { "message": "تم إعادة تعيين كلمة المرور بنجاح" }
# This proves the incidental correctness fix — pre-V-24 this would have 400'd.

# 6. Verify the user's pwChangedAt was updated (V-14a parity):
sudo docker exec -i servix-redis redis-cli GET "servix:pwd-changed-at:$TARGET_USER_ID"
# expected: a millisecond timestamp from the last few seconds.
```

## Rollback

Pure code rollback. Re-pull the previous image tag:

```bash
PREV_TAG=$(cat /home/servix-admin/last-known-good-api.tag)
sudo IMAGE_TAG=$PREV_TAG docker compose -f tooling/docker/docker-compose.prod.yml \
  up -d --force-recreate --no-deps api-1 api-2
```

**No DB state to undo.** Any V-24 rows in `password_resets` will hash-match against the V-24 verifier and the rollback verifier (the verifier was unchanged); they remain valid. Any audit rows with the new action name `admin_password_reset_link_sent` survive unchanged.

The only operational impact of rollback: the pre-V-24 admin path resumes being broken (raw token in DB, console.log leak, un-redeemable link). Acceptable because the pre-V-24 state is what prod was running before V-24, and no consumer relies on the admin reset path working.

## Caveats

1. **No email delivery.** The admin must read the raw token from the API response and deliver it manually (Slack, ticket, in-person). `V-24-email` follow-up wires `MailService` into `AdminModule`. Until then, the response body is the only token surface.
2. **`admin_password_reset_completed` + `admin_password_reset_failed` audits not added.** The self-serve verifier (`auth.service.resetPassword`) cannot distinguish admin-initiated vs self-serve flows without an `initiatedBy` column. Tracked as `V-24-audit-completion` follow-up (paired with `V-24-self-serve-audit` to also add the missing audit on self-serve completion).
3. **Schema column still named `token`** (not `tokenHash`). Cosmetic rename tracked as `V-24-rename`. Not blocking.
4. **No frontend touch.** No SERVIX-served frontend currently invokes `POST /admin/users/:id/send-reset-link`. The new `{ token, expiresAt }` response fields lie ready for when an admin UI calls this endpoint.
5. **Pre-V-24 `password_resets` rows expire naturally.** No cleanup migration. The pre-V-24 admin-issued rows held raw tokens; they couldn't be redeemed before V-24 (bug #3) and won't be redeemable after V-24 either (the hash-of-the-raw wouldn't match the raw stored in the column). Within 1 hour they expire and become harmless.
