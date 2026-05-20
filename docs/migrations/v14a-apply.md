# V-14a / A2-02 — Force-logout (real this time) runbook

**Severity:** HIGH (P1) — partially a bug fix.
**Author:** Engineer 2 (Auth/Identity).
**Created:** 2026-05-20.
**Audit source:** `docs/principal-audit/synthesis-2026-05-14.md` V-14 / A2-02.

## What this card does

Pre-V-14a, four flows that were *supposed* to kill active sessions were no-ops:

| Path | Pre-V-14a behaviour | Post-V-14a |
|---|---|---|
| `POST /admin/users/:id/force-logout` | wrote audit log + bumped `user.updatedAt`. Nothing checks `updatedAt`. | calls `setPasswordChangedAt(userId)`. JWT iat-check kicks in everywhere. |
| `POST /admin/tenants/:id/force-logout` | wrote one audit log. | enumerates `TenantUser` rows, `Promise.all(setPasswordChangedAt)` per member. |
| `POST /admin/tenants/:id/force-password-reset` | called the broken `forceLogoutTenant` above. | calls the fixed version. |
| `POST /admin/users/:id/reset-password` | updated DB password only. | adds `setPasswordChangedAt(targetId)` after the tx. |
| `POST /auth/reset-password` (forgot-password completion) | updated DB password only. | adds `setPasswordChangedAt(reset.userId)` after the tx. |

The actual mechanism that makes these matter is the new check in `jwt.strategy.ts:validate()`: every HTTP request now reads `cacheService.getPasswordChangedAt(payload.sub)` and rejects when `payload.iat * 1000 < pwChangedAt`. This mirrors the V-01 WS guard exactly so HTTP and WS share the same revocation semantics.

## Deploy posture

Pure code change, no schema, no migration. Single rolling deploy across `servix-api-1` and `servix-api-2`.

**Risk:** none for legitimate users — pwChangedAt only blocks tokens issued *before* a recent invalidation event. Users with no invalidation event in their history get `null` from the cache and pass through.

**Operational note:** the cache lookup adds one Redis `GET` per HTTP request after JWT verification. Same overhead the WS guard already pays since V-01. Redis is on the same VM (`servix-redis`) so latency is ≪ 1 ms.

## Pre-conditions

- [ ] V-01 has merged (uses the same `cacheService.getPasswordChangedAt` primitive — no Redis schema overlap).
- [ ] Redis is healthy on prod (it is — the V-01 deploy already validated this).
- [ ] No active deploy on `servix-api-1` or `servix-api-2`.

## Step 0 — Backup verification

Not strictly required (code change, no schema), but the standard discipline:

```bash
ssh servix-admin@194.163.158.70 'sudo ls -lh /var/backups/postgres/ | tail -3'
```

## Step 1 — Rolling deploy

```bash
ssh servix-admin@194.163.158.70 << 'EOF'
  set -e
  cd /home/servix-admin/servix
  sudo docker compose -f tooling/docker/docker-compose.prod.yml pull api-1 api-2
  sudo docker compose -f tooling/docker/docker-compose.prod.yml up -d --force-recreate --no-deps api-1
  sleep 10
  curl -fsS https://api.servi-x.com/api/v1/health | head -2
  sudo docker compose -f tooling/docker/docker-compose.prod.yml up -d --force-recreate --no-deps api-2
  sleep 10
  curl -fsS https://api.servi-x.com/api/v1/health | head -2
EOF
```

## Step 2 — Manual smoke (login → admin force-logout → 401)

```bash
# 1. log in as a real user and capture the access token
TOKEN=$(curl -fsS -X POST https://api.servi-x.com/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"emailOrPhone":"<a-real-user-email>","password":"<…>"}' \
  | jq -r '.tokens.accessToken')
echo "token len: ${#TOKEN}"

# 2. confirm the token works (HTTP 200)
curl -fsS -o /dev/null -w 'before force-logout: HTTP %{http_code}\n' \
  https://api.servi-x.com/api/v1/auth/me \
  -H "Authorization: Bearer $TOKEN"

# 3. admin force-logout (super_admin token required — issue separately)
ADMIN_TOKEN='<super_admin access token>'
USER_ID='<target user id>'
curl -fsS -X POST "https://api.servi-x.com/api/v1/admin/users/$USER_ID/force-logout" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 4. the original token should now return 401 within ~1s
sleep 1
curl -sS -o /dev/null -w 'after force-logout: HTTP %{http_code}\n' \
  https://api.servi-x.com/api/v1/auth/me \
  -H "Authorization: Bearer $TOKEN"
# expected: HTTP 401
```

Repeat the smoke against the WS layer (V-01 already accepts the same primitive) by opening a Socket.IO connection with `$TOKEN` after step 3 — the handshake should be rejected with `Token revoked`.

## Rollback

`git revert` the V-14a commit and redeploy. The change is purely additive at the cache layer — reverting only removes the *reads* from `jwt.strategy.validate()`; any pwChangedAt timestamps already written in Redis will simply be ignored. No data cleanup needed.

```bash
ssh servix-admin@194.163.158.70 << 'EOF'
  cd /home/servix-admin/servix
  sudo docker compose -f tooling/docker/docker-compose.prod.yml pull api-1 api-2
  sudo docker compose -f tooling/docker/docker-compose.prod.yml up -d --force-recreate --no-deps api-1 api-2
EOF
```

## Caveats

1. **TTL** — `setPasswordChangedAt` writes with `REFRESH_BLACKLIST_TTL_SECONDS` (refresh-token expiry, 7 days). After 7 days the key disappears and the gate stops firing. Since the refresh token also expires at the same horizon, an attacker holding only an expired access token cannot trade up — the gate is effectively permanent within the active-session window.
2. **`/auth/logout`** — still blacklists the refresh token only. By design (see V-14d follow-up in `engineer-2-database-auth.md` for the rationale).
3. **WS parity** — the WS guard already does this check since V-01. No additional WS work in V-14a. The bonus e2e test in `test/ws-auth.e2e-spec.ts` ("rejects when pwChangedAt is newer than the token iat") proves the parity.
4. **Service tokens without `iat`** — the strategy short-circuits when `payload.iat` is missing. Documented in the e2e test ("accepts a token with no iat claim — defensive"). If a future service token type needs the gate, add an `iat` claim at issuance time.
