# V-38 / A2-13 — TenantGuard global APP_GUARD runbook

**Severity:** P2 — preventive hardening; closes coverage gap for future controllers added without explicit `@UseGuards(TenantGuard)`.
**Author:** Engineer 2 (Auth/Identity).
**Created:** 2026-05-27.
**Audit source:** `docs/principal-audit/synthesis-2026-05-14.md` V-38 / A2-13.
**Commit:** single — see `git log --oneline -1`. ~10 LOC runtime + 130 LOC tests + docs.

## What this card does

Pre-V-38, `TenantGuard` was opt-in via `@UseGuards(TenantGuard)` on each tenant-data controller. All 30 salon controllers had it (verified in Phase A), so there was no current production gap — but ANY future controller a developer added without the decorator would silently skip the `assertActiveTenantUser` check, allowing a JWT carrying a tenantId the user is no longer a member of to read tenant data.

After V-38 the guard is registered as a global `APP_GUARD` in `app.module.ts` between `TenantMiddleware` and `SubscriptionWriteGuard`:

```ts
providers: [
  { provide: APP_GUARD, useClass: RateLimitGuard },        // 1
  { provide: APP_GUARD, useClass: JwtAuthGuard },          // 2 — sets request.user
  { provide: APP_GUARD, useClass: TenantMiddleware },      // 3 — sets request.tenant
  { provide: APP_GUARD, useClass: TenantGuard },           // 4 — V-38 NEW
  { provide: APP_GUARD, useClass: SubscriptionWriteGuard },// 5
]
```

The guard logic gains two short-circuits so it doesn't over-fire:

1. **`@Public()` routes** — Reflector reads `IS_PUBLIC_KEY` metadata at handler + class scope (same pattern as `JwtAuthGuard`). Returns true immediately for any endpoint decorated `@Public()`.
2. **Routes without `request.tenant`** — TenantMiddleware deliberately skips tenant context for `/admin/*`, `/public/*`, `/booking/*`, `/health/*`, `/auth/*` (see `PUBLIC_TENANT_PATHS` in `tenant.middleware.ts:41-47`) and for JWTs without a `tenantId` claim. TenantGuard treats `!tenant` as "TenantMiddleware decided this route doesn't need tenant binding" and returns true (single source of truth — no duplicate route classification).

When BOTH conditions fail (i.e., a real tenant-data route with `request.tenant` populated), the guard runs the same checks it always did:
- `request.user` present
- `tenant.status !== 'suspended'` (redundant with TenantMiddleware; V-14e-dry tracks the cleanup)
- `assertActiveTenantUser(tenant.id, user.sub)` — the V-14b helper verifying the JWT user has an ACTIVE TenantUser row linking them to the JWT's tenant + the tenant itself is active.

## Coverage delta — preventive, not corrective

Phase A audit confirmed:
- All 30 `/modules/salon/*.controller.ts` files already have `@UseGuards(TenantGuard)` → no current gap.
- 2 non-salon controllers (`core/notifications`, `shared/whatsapp/whatsapp-connect`) also have the explicit decorator.
- The 9 `@Public()` controllers (auth, health, metrics, webhooks, public, compliance, admin-login) all match TenantMiddleware's `PUBLIC_TENANT_PATHS` allowlist.

**V-38 is purely preventive.** No production endpoint changes behavior. The protection activates the moment any future controller is added without the explicit decorator.

The 30 existing `@UseGuards(TenantGuard)` decorators become redundant (NestJS runs each guard exactly once even when registered via both APP_GUARD and `@UseGuards()`). They stay in place as belt-and-braces during cutover — tracked as `V-38-cleanup` follow-up to remove in a separate ~30-file PR.

## Deploy posture

**Pure runtime card.** No platform or tenant migration. No new dependency (Reflector is built into `@nestjs/core`). Standard rolling deploy:

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

**Any deploy window** — strictly-more-permissive change (new short-circuits added, no new throws on existing endpoints). Risk profile near-zero.

## Post-deploy smoke

```bash
# Pre-req: log in as a real user (with active tenant assignment).
TOKEN=$(curl -fsS -X POST https://api.servi-x.com/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"emailOrPhone":"<email>","password":"<pw>"}' | jq -r '.data.tokens.accessToken')

# 1. Public route (login itself) — still works without JWT.
curl -fsS -X POST https://api.servi-x.com/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"emailOrPhone":"x","password":"x"}' | head -2
# expected: 401 (invalid credentials), NOT 403 (V-38 ForbiddenException)

# 2. Admin route — request.tenant undefined, guard short-circuits.
ADMIN_TOKEN=$(curl -fsS -X POST https://api.servi-x.com/api/v1/admin/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"<super_admin>","password":"<pw>"}' | jq -r '.data.accessToken')
curl -fsS https://api.servi-x.com/api/v1/admin/stats -H "Authorization: Bearer $ADMIN_TOKEN" | head -2
# expected: 200 (admin route works without tenant context)

# 3. Tenant-data route — happy path.
curl -fsS https://api.servi-x.com/api/v1/employees -H "Authorization: Bearer $TOKEN" | head -2
# expected: 200 (user is active TenantUser of the JWT's tenant)
```

For the negative-case smoke (user revoked from tenant) you need to manually:
1. Note the user's `tenantUsers.id` in the platform DB.
2. `UPDATE tenant_users SET status='inactive' WHERE id=$1`.
3. **Don't** force-logout (V-14a) so the old JWT survives.
4. Retry the `/employees` call → expect 403 ForbiddenException (V-38 closes this).
5. Restore the row to `status='active'` afterwards.

## Rollback

Pure code rollback. Re-pull the previous image tag:

```bash
PREV_TAG=$(cat /home/servix-admin/last-known-good-api.tag)
sudo IMAGE_TAG=$PREV_TAG docker compose -f tooling/docker/docker-compose.prod.yml \
  up -d --force-recreate --no-deps api-1 api-2
```

No DB state to undo. Post-rollback, future controllers added without the explicit decorator regain the silent gap; the 30 existing controllers continue to enforce TenantUser membership via their explicit `@UseGuards(TenantGuard)`.

## Caveats

1. **30 redundant `@UseGuards(TenantGuard)` decorators** remain on salon controllers post-V-38. NestJS deduplicates so there's no perf cost; the decorators serve as inline documentation. Tracked as `V-38-cleanup` follow-up.
2. **TenantGuard's `tenant.status === 'suspended'` check duplicates TenantMiddleware's.** Both fire; the redundancy was previously flagged by V-14e-dry. V-38 keeps the duplicate as belt-and-braces; the cleanup follows the same V-14e-dry plan.
3. **No `@SkipTenantCheck()` decorator added.** Admin routes naturally skip via the `!request.tenant` short-circuit since TenantMiddleware's `PUBLIC_TENANT_PATHS` already excludes them. Adding a new decorator would create a parallel control surface — rejected.
4. **No new audit on `assertActiveTenantUser` rejection.** The existing `ForbiddenException` with the localized message is sufficient. If ops sees a spike in 403s post-V-38, that's the signal — track as `V-38-audit` follow-up if needed.
5. **APP_GUARD order MUST be preserved.** TenantGuard reads `request.user` (set by JwtAuthGuard #2) AND `request.tenant` (set by TenantMiddleware #3). Moving TenantGuard before either would break the global chain. CI doesn't catch this; rely on code review.
