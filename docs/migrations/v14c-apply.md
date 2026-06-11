# V-14c / A2-07 — Role change session invalidation runbook

**Severity:** HIGH (P1) — privilege-downgrade window.
**Author:** Engineer 2 (Auth/Identity).
**Created:** 2026-05-21.
**Audit source:** `docs/principal-audit/synthesis-2026-05-14.md` V-14 / A2-07.

## What this card does

Pre-V-14c, `PUT /admin/users/:id/role` flipped `tenant_user.roleId` and wrote an audit row. **No session invalidation.** The dangerous direction was privilege downgrade:

- Admin demotes a user from `manager` to `staff`. DB is updated.
- The user's existing JWT still carries `roleId = <manager id>`. `RolesGuard` reads `payload.roleId` and looks it up — the manager role record still exists, so the check passes.
- The user keeps manager-grade access until the JWT expires (≤ 15 min) or refreshes. **The refresh path is also stale** (`auth.service.refreshTokens:357` re-uses `payload.roleId` from the refresh token), so a determined attacker could hang on indefinitely by refreshing.

After V-14c:

| Layer | Before | After |
|---|---|---|
| `admin.service.changeUserRole` | DB tx + audit row only | + `setPasswordChangedAt(userId)` + `eventsGateway.disconnectUserClients(userId)` + audit row enriched with `oldRoleId` and `sessionsRevoked: true` |
| HTTP JWT validation | `RolesGuard` reads stale `roleId` from JWT — passes | `JwtStrategy.validate` (V-14a) rejects on `iat < pwChangedAt` before `RolesGuard` runs. User re-logs in; new JWT carries new roleId from `firstTenantUser` |
| WS active sessions | Stay open with stale role | Immediately disconnected from `user:<id>` room; handshake guard now sees the post-V-14c state |
| Refresh path staleness | Re-issues with old roleId | Refresh check (`auth.service:348`) sees `iat < pwChangedAt`, returns 401, forces full re-login |

V-14c closes the role-change gap *and* the refresh-staleness gap as a single side effect — by forcing full re-login through the V-14a primitive.

## Deploy posture

Pure code change. Same rolling deploy as V-14a/b — `force-recreate` `api-1`, health check, then `api-2`.

Behaviour change is bounded to `PUT /admin/users/:id/role` (super_admin-only endpoint). Legitimate active users untouched.

## Pre-conditions

- [ ] V-14a + V-14b on prod (same `setPasswordChangedAt` + `eventsGateway` primitives — no additional infrastructure).
- [ ] Redis healthy.
- [ ] No active deploy on `servix-api-1` / `-2`.

## Step 0 — Backup verification

Standard discipline:
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

## Step 2 — Manual smoke (privilege downgrade)

The test that matters most: an existing manager JWT must lose its admin-like access after demotion.

```bash
# 1. Capture a tenant-member's access token while they are 'manager'.
USER_TOKEN=$(curl -fsS -X POST https://api.servi-x.com/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"emailOrPhone":"<a manager email>","password":"<…>"}' \
  | jq -r '.tokens.accessToken')

# 2. Confirm the token works.
curl -fsS -o /dev/null -w 'before role-change: HTTP %{http_code}\n' \
  https://api.servi-x.com/api/v1/auth/me \
  -H "Authorization: Bearer $USER_TOKEN"
# expected: HTTP 200

# 3. Admin demotes them to 'staff'.
ADMIN_TOKEN='<super_admin token>'
USER_ID='<target user id>'
STAFF_ROLE_ID='<staff role uuid>'
curl -fsS -X PUT "https://api.servi-x.com/api/v1/admin/users/$USER_ID/role" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"roleId\":\"$STAFF_ROLE_ID\"}"

# 4. The same JWT must now fail.
sleep 1
curl -sS -o /dev/null -w 'after role-change: HTTP %{http_code}\n' \
  https://api.servi-x.com/api/v1/auth/me \
  -H "Authorization: Bearer $USER_TOKEN"
# expected: HTTP 401 (Token revoked)

# 5. Refresh attempt with the user's stored refresh token must also fail.
REFRESH_TOKEN='<the refresh token saved before step 3>'
curl -sS -o /dev/null -w 'refresh after role-change: HTTP %{http_code}\n' \
  -X POST https://api.servi-x.com/api/v1/auth/refresh \
  -H 'Content-Type: application/json' \
  -d "{\"refreshToken\":\"$REFRESH_TOKEN\"}"
# expected: HTTP 401 — refresh path also gated by pwChangedAt

# 6. User re-logs in, new JWT carries new roleId.
NEW_TOKEN=$(curl -fsS -X POST https://api.servi-x.com/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"emailOrPhone":"<same email>","password":"<…>"}' \
  | jq -r '.tokens.accessToken')
curl -fsS -o /dev/null -w 'fresh login: HTTP %{http_code}\n' \
  https://api.servi-x.com/api/v1/auth/me \
  -H "Authorization: Bearer $NEW_TOKEN"
# expected: HTTP 200, new role active

# 7. Optional: WS smoke. Open a Socket.IO connection with $USER_TOKEN
#    *before* step 3, then watch for the 'disconnect' event within ~1s
#    of the role-change call.
```

## Rollback

`git revert` the V-14c commit and redeploy. Additive at the cache layer — reverting stops new pwChangedAt writes from the role-change path. Existing timestamps in Redis stay. The role change itself remains persisted (we don't try to reverse history); admins re-apply the role if needed.

```bash
ssh servix-admin@194.163.158.70 << 'EOF'
  cd /home/servix-admin/servix
  sudo docker compose -f tooling/docker/docker-compose.prod.yml pull api-1 api-2
  sudo docker compose -f tooling/docker/docker-compose.prod.yml up -d --force-recreate --no-deps api-1 api-2
EOF
```

## Caveats

1. **Multi-tenant users** — same posture as V-14a/b. Changing a role on tenant B kills the user's JWT pinned to tenant A. Acceptable over-invalidation; the user re-logs in and the firstTenantUser logic picks an active TU.
2. **No-op role changes** — calling `PUT /admin/users/:id/role` with the same `roleId` still cascades. Defensive over efficient; the cost is one Redis SETEX. Recorded behaviour in commit body.
3. **`RolesGuard` mechanics** — pre/post-V-14c the guard still does `prisma.role.findUnique({ where: { id: user.roleId } })`. We did **not** switch to a DB role re-read in `JwtStrategy` because the stale-JWT problem is closed entirely by `setPasswordChangedAt`; adding a per-request DB read for the role would be duplicate work.
4. **Refresh path** — `auth.service.refreshTokens` still re-uses `payload.roleId`. We did **not** patch it. V-14c writes pwChangedAt, which fails the existing refresh-path check (`auth.service:348`, `iat < pwChangedAt`), forcing a full re-login that mints a fresh JWT with the new role from `firstTenantUser`. Same gap closed through a different gate.
5. **`disconnectUserClients` failures** — wrapped in `try/catch` inside the gateway helper. Redis-adapter blips are logged at `warn`, never thrown. The cascade still completes because the security guarantee (`pwChangedAt`) is independent of the WS layer.
