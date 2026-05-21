# V-14b / A2-06 — Suspend Tenant cascade runbook

**Severity:** HIGH (P1) — partially a bug fix.
**Author:** Engineer 2 (Auth/Identity).
**Created:** 2026-05-21.
**Audit source:** `docs/principal-audit/synthesis-2026-05-14.md` V-14 / A2-06.

## What this card does

Pre-V-14b, `PUT /admin/tenants/:id/status` flipped `tenant.status='suspended'` and wrote one audit row. Nothing else happened:
- HTTP requests with existing JWTs continued working until the access token's natural 15-minute expiry, even though `tenant.middleware` and `TenantGuard` already short-circuited on `status='suspended'` (so endpoints failed, but `/auth/me` and similar non-tenant-scoped paths kept returning 200).
- The V-01 WS guard only checked `tenant_user.status='active'`, not `tenant.status`, so a suspended-tenant member could open a fresh Socket.IO connection.
- Active WS sessions stayed open forever; they only paid attention to the next handshake.

After V-14b:

| Layer | Before | After |
|---|---|---|
| `assertActiveTenantUser` helper | check `tenantUser.status='active'` | also checks `tenant.status='active'`. Both HTTP `TenantGuard` and WS `WsAuthGuard` pick this up automatically because they share the helper. |
| `admin.service.updateTenantStatus('suspended')` | DB update + 1 audit row | + enumerate `TenantUser` rows + `setPasswordChangedAt` per member + `eventsGateway.disconnectTenantClients(tenantId)` + `cacheService.invalidateTenant(tenantId)` + audit row enriched with `affectedUserCount`. |
| `admin.service.updateTenantStatus('active')` (unsuspend) | DB update + 1 audit row | + `invalidateTenant` so other api instances see the new status immediately. **Does not clear `pwChangedAt`** — once revoked, stay revoked; users re-login with fresh `iat > pwChangedAt`. |

## Deploy posture

Pure code change. Same rolling deploy as V-14a — `force-recreate` `api-1`, health check, then `api-2`.

Behaviour change is bounded to admin-initiated suspend flows; legitimate active users in non-suspended tenants see no difference (the helper accepts them as before).

## Pre-conditions

- [ ] V-14a is on prod (uses the same `cacheService.setPasswordChangedAt` primitive — no additional Redis schema).
- [ ] Redis healthy (already validated by V-01/V-14a deploys).
- [ ] No active deploy on `servix-api-1` / `-2`.

## Step 0 — Backup verification

Standard discipline; this is a code change, not schema.
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

## Step 2 — Manual smoke (admin suspend → 401 + WS disconnect)

Pick a low-traffic active tenant for the smoke (e.g. `test-ai-reception` — only test data). **Confirm with the owner before suspending any other tenant.**

```bash
# 1. Capture a tenant-member's access token (login as that user).
USER_TOKEN=$(curl -fsS -X POST https://api.servi-x.com/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"emailOrPhone":"<member email>","password":"<…>"}' \
  | jq -r '.tokens.accessToken')

# 2. Confirm it works on a tenant-scoped path.
curl -fsS -o /dev/null -w 'before suspend: HTTP %{http_code}\n' \
  https://api.servi-x.com/api/v1/auth/me \
  -H "Authorization: Bearer $USER_TOKEN"
# expected: HTTP 200

# 3. Admin suspend.
ADMIN_TOKEN='<super_admin token>'
TENANT_ID='<target tenant uuid>'
curl -fsS -X PUT "https://api.servi-x.com/api/v1/admin/tenants/$TENANT_ID/status" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"status":"suspended"}'

# 4. Same user token must now fail.
sleep 1
curl -sS -o /dev/null -w 'after suspend: HTTP %{http_code}\n' \
  https://api.servi-x.com/api/v1/auth/me \
  -H "Authorization: Bearer $USER_TOKEN"
# expected: HTTP 401  (Token revoked)

# 5. Active WS check (if a session was open against this tenant) — confirm
#    `EventsGateway` log shows "Client disconnected: …" for that socket id
#    within ~1s of the suspend.

# 6. Unsuspend to restore.
curl -fsS -X PUT "https://api.servi-x.com/api/v1/admin/tenants/$TENANT_ID/status" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"status":"active"}'

# 7. User must re-login (the pwChangedAt is permanent; old token stays dead by design).
curl -fsS -X POST https://api.servi-x.com/api/v1/auth/login ... # fresh token
```

## Rollback

`git revert` the V-14b commit and redeploy. Like V-14a, the change is additive at the cache layer — reverting only stops new `setPasswordChangedAt` writes from the suspend path. Existing pwChangedAt timestamps in Redis stay (they were correct), and the helper goes back to the V-14a behaviour (tenantUser-only check). No data cleanup needed.

```bash
ssh servix-admin@194.163.158.70 << 'EOF'
  cd /home/servix-admin/servix
  sudo docker compose -f tooling/docker/docker-compose.prod.yml pull api-1 api-2
  sudo docker compose -f tooling/docker/docker-compose.prod.yml up -d --force-recreate --no-deps api-1 api-2
EOF
```

## Caveats

1. **Multi-tenant users** — a user linked to suspended A and active B who has a JWT pinned to A gets `Token revoked` (pwChangedAt was written), re-logs in, and `auth.service.login` currently still pins them to A first (returning a JWT for the suspended tenant). Tracked as V-14b-login follow-up — Engineer 3 UX scope.
2. **Unsuspend does not restore old sessions** — by design. Same secure-default as V-14a force-logout.
3. **`affectedUserCount` accuracy** — the audit row writes `members.length`, the count we attempted, not the count of successful Redis writes. Setting matches V-14a's `forceLogoutTenant`; the cleanup is tracked as **V-14a-perf-counter** in `engineer-2-database-auth.md` (one bucket for both methods).
4. **WS disconnect** — `server.in('tenant:<id>').disconnectSockets(true)` runs on whichever api instance handles the suspend request. The Redis adapter (`@socket.io/redis-adapter` already configured in `redis-io.adapter.ts`) propagates the namespace operation to the other instance, so both `api-1` and `api-2` execute the disconnect. No additional fan-out wiring needed.
5. **`tenants.service.suspend` orphan** — there's a dead `suspend(id)` method in `tenants.service.ts` with no caller and no cascade. Recorded as a follow-up in `engineer-2-database-auth.md`. **Do not call it from anywhere.** Use `admin.service.updateTenantStatus(tenantId, 'suspended', adminId)` instead.
