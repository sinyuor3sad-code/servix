# V-13c / A2-05 — Refresh-token rotation + reuse detection runbook

**Severity:** HIGH (P1) — refresh-token replay window + missing rotation.
**Author:** Engineer 2 (Auth/Identity).
**Created:** 2026-05-25.
**Audit source:** `docs/principal-audit/synthesis-2026-05-14.md` V-13 / A2-05.
**Commits on this branch:** `dfd2a42` (schema), `48195eb` (runtime), `<commit3>` (tests/docs).

## What this card does

Pre-V-13c the API issued **signed JWT refresh tokens** with a 7-day window, no per-token state, and no replay detection. Concretely:

| Pre-V-13c behaviour | Risk |
|---|---|
| Refresh = signed JWT, validated by signature + exp only | Stolen token replayable for up to 7 days. No way to detect that two parties hold the same token. |
| Logout = blacklist the token hash for 7d in Redis+DB | Works for normal logout. Useless for a stolen token: the legitimate user never knows it was stolen, so never triggers logout. |
| No "family" concept | A stolen refresh can be silently rotated by the attacker (request `/auth/refresh`), getting a fresh 7d token + access JWT, forever. |

After V-13c:

- Refresh tokens are **opaque 32-byte hex** (256 bits, `crypto.randomBytes`), persisted in `platform.refresh_tokens` keyed by SHA-256 hash. The raw value is returned to the client once at issue time and never stored. **V-13b's no-Math-random rule guards the entropy source.**
- Every `/auth/refresh` **rotates**: the presented row is marked `revoked_at=NOW(), revoked_reason='rotated', replaced_by_token_id=<successor.id>` and a fresh row is issued in the same `family_id`.
- Presenting a token whose row already has `revoked_at IS NOT NULL` is treated as **replay** and triggers a cascade:
  1. `UPDATE refresh_tokens SET revoked_at=NOW(), revoked_reason='reuse_detected' WHERE family_id=$1 AND revoked_at IS NULL` (kills every sibling in the family).
  2. `cacheService.setPasswordChangedAt(userId)` — invalidates every outstanding access JWT via the V-14a gate.
  3. `cacheService.blacklistRefreshToken(hash)` — belt-and-braces with the legacy TokenBlacklist short-circuit.
  4. `auditService.log({ action: 'auth_refresh_reuse_detected', ... })` with full forensic breadcrumb.
  5. `sentryService.captureMessage('Refresh token reuse detected', 'warning')`.
  6. 401 to the caller (same shape as "unknown token" — no timing channel).
- DB unreachable on the refresh path → **503 ServiceUnavailable** (deliberate **fail-CLOSED** deviation from the legacy blacklist fail-open in `cache.service.ts:387`). Reuse detection IS the security control here; an attacker exploiting DB+Redis outage to replay a stolen token is exactly the threat model.
- V-14a parity preserved: `pwChangedAt > issuedAt` still kills the token, now with `revoked_reason='pwd_changed'` on the row.

## ⚠️ Breaking change

**Every refresh token that was issued before this deploy becomes invalid the moment `apps/api` restarts.** The lookup-by-hash path simply finds nothing for them — they were signed JWTs without rows. Users keep their (up-to-15min) access JWT until it expires, then their next refresh returns 401 and the client must re-login.

**Owner coordination required before deploy.** Pick an off-peak window. Do not deploy during peak booking hours. After deploy, expect a spike of `/auth/refresh` 401s and a corresponding spike of `/auth/login` calls — both are normal cutover signals, not regressions.

## Deploy posture

Two-phase deploy (schema first, runtime second) is the standard pattern. Applying the schema migration is safe on its own — the runtime in commit 1 still issues signed-JWT refresh tokens; the new `refresh_tokens` table simply sits empty.

### Phase 1 — Apply schema migration (low-risk, can land days before runtime)

```bash
ssh servix-admin@194.163.158.70 << 'EOF'
  set -euo pipefail
  cd /home/servix-admin/servix

  # Verify backup < 1h old (V-13c is HIGH P1; pre-flight backup discipline holds).
  ls -la /var/backups/servix/postgres/ | tail -3

  # Apply the platform-only migration.
  sudo docker exec -i servix-postgres psql -U servix -d servix_platform \
    < apps/api/prisma/platform-migrations/20260525_v13c_refresh_tokens.sql

  # Verify the table + indices + FKs.
  sudo docker exec -i servix-postgres psql -U servix -d servix_platform <<SQL
    \d refresh_tokens
    SELECT conname, confdeltype FROM pg_constraint
      WHERE conrelid = 'refresh_tokens'::regclass AND contype = 'f';
    SELECT COUNT(*) AS row_count FROM refresh_tokens;
SQL
EOF
```

Expected output:
- `\d refresh_tokens` shows 11 columns, 4 indices (incl. `refresh_tokens_token_hash_key UNIQUE`), 2 FKs.
- `pg_constraint` query shows two rows: `refresh_tokens_user_id_fkey | c` (cascade) and `refresh_tokens_replaced_by_token_id_fkey | n` (set null).
- `row_count` = 0.

### Phase 2 — Roll out runtime (rolling api-1 → api-2)

```bash
ssh servix-admin@194.163.158.70 << 'EOF'
  set -euo pipefail
  cd /home/servix-admin/servix

  # Pull new images (schema migration must already be applied per Phase 1).
  sudo docker compose -f tooling/docker/docker-compose.prod.yml pull api-1 api-2

  # Rolling: api-1 first, smoke, then api-2.
  sudo docker compose -f tooling/docker/docker-compose.prod.yml up -d --force-recreate --no-deps api-1
  sleep 10
  curl -fsS https://api.servi-x.com/api/v1/health | head -2

  sudo docker compose -f tooling/docker/docker-compose.prod.yml up -d --force-recreate --no-deps api-2
EOF
```

## Post-deploy smoke

```bash
# 1. Login → save the refresh token.
LOGIN=$(curl -fsS -X POST https://api.servi-x.com/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"emailOrPhone":"<test account>","password":"<...>"}')
RT_OLD=$(echo "$LOGIN" | jq -r '.data.tokens.refreshToken')

# 2. Refresh once — expect new tokens, old refresh now revoked.
RT_NEW=$(curl -fsS -X POST https://api.servi-x.com/api/v1/auth/refresh \
  -H 'Content-Type: application/json' \
  -d "{\"refreshToken\":\"$RT_OLD\"}" | jq -r '.data.refreshToken')
test "$RT_OLD" != "$RT_NEW" || (echo "ERROR: token did not rotate"; exit 1)

# 3. Verify rotation in DB.
sudo docker exec -i servix-postgres psql -U servix -d servix_platform <<SQL
  SELECT id, family_id, revoked_at, revoked_reason, replaced_by_token_id
  FROM refresh_tokens
  WHERE user_id = (SELECT id FROM users WHERE email = '<test account>')
  ORDER BY issued_at DESC LIMIT 3;
SQL
# Expect: row 1 = newest (revoked_at IS NULL),
#         row 2 = predecessor (revoked_at NOT NULL, revoked_reason='rotated',
#                              replaced_by_token_id = row 1's id).

# 4. Replay attack simulation — RT_OLD is already revoked. Expect 401 + cascade.
HTTP=$(curl -s -o /dev/null -w '%{http_code}' -X POST https://api.servi-x.com/api/v1/auth/refresh \
  -H 'Content-Type: application/json' \
  -d "{\"refreshToken\":\"$RT_OLD\"}")
test "$HTTP" = "401" || (echo "ERROR: replay was not rejected (got $HTTP)"; exit 1)

# 5. Verify the cascade fired.
sudo docker exec -i servix-postgres psql -U servix -d servix_platform <<SQL
  -- Every token in this family should now be revoked.
  SELECT COUNT(*) FILTER (WHERE revoked_at IS NULL) AS still_active,
         COUNT(*) FILTER (WHERE revoked_reason = 'reuse_detected') AS reuse_marked
  FROM refresh_tokens
  WHERE family_id = (
    SELECT family_id FROM refresh_tokens
    WHERE token_hash = encode(sha256('$RT_OLD'::bytea), 'hex')
  );
  -- Expect: still_active = 0, reuse_marked >= 1.

  -- Audit row should exist.
  SELECT action, new_values->>'familyId', new_values->>'cascadeRevokedCount'
  FROM platform_audit_logs
  WHERE action = 'auth_refresh_reuse_detected'
  ORDER BY created_at DESC LIMIT 1;
SQL

# 6. Sentry: check the security warning landed.
#    Open https://sentry.io/.../issues/?query=is%3Aunresolved+%22Refresh+token+reuse+detected%22
#    Expect: one new warning issue from the smoke.
```

## Rollback

V-13c is two distinct rollbacks depending on which phase you need to undo.

### Runtime rollback (preferred — leaves schema in place)

```bash
ssh servix-admin@194.163.158.70 << 'EOF'
  cd /home/servix-admin/servix
  # Re-pull the previous image tags (deploy.yml snapshots them per run).
  PREV_TAG=$(cat /home/servix-admin/last-known-good-api.tag)
  sudo docker compose -f tooling/docker/docker-compose.prod.yml \
    pull api-1 api-2 --policy missing
  sudo IMAGE_TAG=$PREV_TAG docker compose -f tooling/docker/docker-compose.prod.yml \
    up -d --force-recreate --no-deps api-1 api-2
EOF
```

After runtime rollback, the `refresh_tokens` table sits unused — the previous JWT-signing code path doesn't touch it. Re-applying the runtime later just needs a fresh deploy of the V-13c images. The accumulated `refresh_tokens` rows (if any) are harmless until then.

### Schema rollback (only if Phase 1 itself fails)

```sql
BEGIN;
DROP TABLE IF EXISTS refresh_tokens CASCADE;
-- (CASCADE only drops the FKs we created in this migration.)
COMMIT;
```

`refresh_tokens` is a leaf table — no other table references it. Dropping is safe at any time before Phase 2 ships.

## Caveats

1. **TokenBlacklist coexistence.** The existing `token_blacklist` table is unchanged. Logout writes BOTH (revoke the `refresh_tokens` row AND blacklist the hash). The blacklist's fail-open read path is no longer consulted on the refresh path (the new `refresh_tokens` lookup is the source of truth). V-13c-cleanup consolidates after 30 days clean operation.

2. **Fail-CLOSED is a behaviour change.** Pre-V-13c, if Redis AND DB were both down, the refresh path **fell through and minted new tokens** (cache.service.ts:387 "DB also failed — fail open"). Post-V-13c, the refresh path returns 503. This is intentional — see commit 2 body for the threat-model rationale — but it does mean a Postgres outage now blocks new access-token issuance until DB recovers. Existing access tokens stay valid until their 15min lifetime expires, so the user-facing impact is bounded.

3. **Race window accepted.** Two concurrent refreshes of the same valid token both succeed in issuing successors. The slower write loses `revoked_reason='rotated'`. Not a security issue (both successors are legitimate from the user's perspective); tracked as V-13c-race-tuning follow-up. Empirically nil traffic — clients don't race refresh under normal flows.

4. **JwtRefreshStrategy is dead code.** `apps/api/src/core/auth/strategies/jwt-refresh.strategy.ts` is registered as a provider but no guard references it; it would reject opaque tokens as bad signatures anyway. Left in place; V-13c-strategy-cleanup follow-up removes it.

5. **No threading of ip/UA into login/2FA/google/email-OTP issuance.** Only the refresh path captures ip/UA on issued rows. The 5 other generateTokens callers write null. V-13c-forensics follow-up wires them up at all 5 issuance sites.

6. **30-day data retention.** `refresh_tokens` rows are never deleted by the app — they're history. An expiry-aware cleanup job is a V-13c-gc follow-up. Until then, the table grows linearly with login volume. At ~1k DAU × 1 family/day × 7 rotations/day, that's ~50k rows/week — easily within Postgres's comfort zone but worth a quarterly truncate of `revoked_at < NOW() - INTERVAL '90 days'`.
