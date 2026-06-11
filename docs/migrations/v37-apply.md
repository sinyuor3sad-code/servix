# V-37 / A2-12 — QuotaGuard header trust removal runbook

**Severity:** P2 — client-controlled header could poison quota-guard audit log.
**Author:** Engineer 2 (Auth/Identity).
**Created:** 2026-05-27.
**Audit source:** `docs/principal-audit/synthesis-2026-05-14.md` V-37 / A2-12.
**Commit:** single — see `git log --oneline -1`. Smallest card in the session (~15 LOC + ~50 LOC tests + docs).

## What this card does

Pre-V-37, `apps/api/src/shared/guards/quota.guard.ts:25` resolved the tenant identifier via:

```ts
const tenantId = request.headers?.['x-tenant-id'] || request.user?.tenantId;
```

The `||` chain gave the client-controlled `x-tenant-id` header **PRIORITY** over the JWT-derived `request.user.tenantId`. A caller could spoof the header with an arbitrary string — that value would then appear in the guard's local `tenantId` variable used for:

1. The `if (!tenantId) return true` short-circuit (allow when no tenant context).
2. The `logger.warn(\`Quota exceeded: tenant=${tenantId}, …\`)` audit-log line.

After V-37 the guard reads JWT only:

```ts
const tenantId = request.user?.tenantId;
```

## Exploit-surface narrowing — important nuance

The actual quota-enforcement data (`request.tenant`, `request.tenantDb`) comes from `TenantMiddleware` which derives them from the JWT, NOT from the header. So pre-V-37 the spoofable header could not redirect the quota check itself — usage was counted against the JWT's real tenant. The exploit surface was bounded to:

- **Audit-log integrity:** attacker could poison `tenant=${tenantId}` in the warn line with arbitrary strings (forensic log corruption).
- **Empty-JWT-tenantId edge case:** users with `user.tenantId=''` (no active tenant assignment, common during signup / admin routes per V-13c's `firstTU?.tenantId ?? ''`) could have the header trigger the truthy branch and let the quota check proceed under an inconsistent identity.

Post-V-37 both close. **No legitimate caller affected** — V-37 Phase A grep confirmed no SERVIX frontend (`apps/dashboard`, `apps/booking`, `apps/admin`) sends `x-tenant-id`.

## Deploy posture

**Pure runtime card.** No platform or tenant migration. No new dependency. **The guard is NOT currently wired** as an `APP_GUARD` or via `@UseGuards()` anywhere in the codebase — V-37 is preemptive hardening before the guard gets mounted in a future card. Standard rolling deploy:

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

**Any deploy window** — no breaking change for users, no schema, no migration. The guard isn't gating any requests today.

## Post-deploy smoke

Since the guard isn't wired, there's no direct HTTP surface to test against. The unit-test coverage (`apps/api/src/shared/guards/quota.guard.spec.ts`, 10/10 passing) is the proof.

If the guard IS wired in a future card (e.g. global `APP_GUARD`):

```bash
# 1. Login as a real user (with a tenant assigned in their JWT).
TOKEN=$(curl -fsS -X POST https://api.servi-x.com/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"emailOrPhone":"<email>","password":"<pw>"}' | jq -r '.data.tokens.accessToken')

# 2. Create a quota-managed resource WHILE sending a spoofed x-tenant-id header.
#    Post-V-37, the header is silently ignored; the quota counts against
#    the JWT-real tenant.
curl -fsS -X POST https://api.servi-x.com/api/v1/employees \
  -H "Authorization: Bearer $TOKEN" \
  -H 'x-tenant-id: spoofed-attacker-tenant' \
  -H 'Content-Type: application/json' \
  -d '{"fullName":"Test","email":"t@x.com"}'

# 3. Check the api logs — the warn line (if quota triggers) should show
#    the JWT tenant, NOT 'spoofed-attacker-tenant'.
sudo docker compose -f tooling/docker/docker-compose.prod.yml logs --tail=50 api-1 | grep 'Quota exceeded'
```

## Rollback

Pure code rollback. Re-pull the previous image tag:

```bash
PREV_TAG=$(cat /home/servix-admin/last-known-good-api.tag)
sudo IMAGE_TAG=$PREV_TAG docker compose -f tooling/docker/docker-compose.prod.yml \
  up -d --force-recreate --no-deps api-1 api-2
```

No DB state to undo. The guard re-introduces the spoofable pattern on rollback — acceptable as a temporary incident-response measure, NOT a long-term state.

## Caveats

1. **`feature-flag.guard.ts:35` has the same pattern (lower severity).** `tenantId: request.tenant?.id || request.headers?.['x-tenant-id']` — JWT has PRIORITY here (header is fallback only), so the exploit surface is narrower. Out of V-37 scope (Engineer 3 territory). Tracked as `V-37b-feature-flag` follow-up.
2. **Guard not currently wired.** V-37 closes the spoofable pattern before any global registration. If a future card wires `QuotaGuard` as `APP_GUARD`, the live behavior gets exercised then.
3. **`detectResource` uses controller-name pattern matching** (e.g. `controller.includes('employee')`) at quota.guard.ts:61-69. Code smell unrelated to V-37 — tracked as `V-37c-detect-resource` follow-up.
4. **`getActualUsage` fails open on DB errors** (`return 0` at line 98). Permits resource creation when the count query throws — opposite of V-13c's fail-CLOSED stance for security-critical counts. Tracked as `V-37d-quota-fail-policy` follow-up; re-evaluate at next quota incident.
5. **No `x-tenant-id` sender in SERVIX frontend** — Phase A grep across `apps/dashboard`, `apps/booking`, `apps/admin` confirmed zero `headers: { 'x-tenant-id': ... }` callers. Header is silently dropped post-V-37; no client breakage.
