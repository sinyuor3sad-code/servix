# V-43 / A2-17 — Admin login hardening runbook

**Severity:** P2 — super_admin login lacked 2FA enforcement, IP allowlist, and audit.
**Author:** Engineer 2 (Auth/Identity).
**Created:** 2026-05-29.
**Audit source:** `docs/principal-audit/synthesis-2026-05-14.md` V-43 / A2-17.
**Commit:** single — ~140 LOC runtime + ~280 LOC tests (incl. helper unit spec) + docs.

## What this card does

Pre-V-43, `admin.service.login` issued tokens after a bare password check — the highest-privilege principal (super_admin, cross-tenant control) had **no second factor even when `twoFactorEnabled=true`**, **no IP restriction**, and **zero audit trail** on login.

After V-43:

| Layer | Behavior |
|---|---|
| **IP allowlist** | `ADMIN_IP_ALLOWLIST` env (CSV of IPv4 / IPv4-CIDR). Empty = disabled (all IPs). Blocked IPs → 403 + `logger.warn` + (follow-up) Prometheus counter. Checked FIRST, before user lookup. |
| **bcrypt timing equalization** | User-not-found runs a dummy bcrypt (V-41 parity) — super_admin emails can't be enumerated by response time. |
| **2FA enforcement** | If the super_admin has `twoFactorEnabled` → login step 1 returns `{ requires2FA: true }` (no tokens). Caller completes via `POST /admin/auth/2fa/verify` (email + password + 6-digit code). **Enforce-if-enabled** — un-enrolled super_admins are NOT locked out. |
| **Audit** | 4 new actions: `admin_login_success`, `admin_login_2fa_required`, `admin_login_2fa_failed`, `admin_login_failed` (bad password). All carry `ip` in `newValues`. |

New endpoint: `POST /admin/auth/2fa/verify` — `@Public() @Roles() @RateLimit(5, 300)`, mirrors the login endpoint's guards. Issues a super_admin-payload token (`roleId = superAdminRole.id`) — it does NOT reuse the user-facing `verify2FALogin` (which would build a non-admin payload from `tenantUsers[0]`).

## ⚠️ Pre-deploy: confirm super_admin 2FA enrollment

V-43 is **enforce-if-enabled**. If `admin@servi-x.com` (or any super_admin) does NOT have `twoFactorEnabled=true`, the 2FA enforcement is **inert for that account** — they continue logging in with password alone (but now with IP allowlist + audit).

```sql
-- Check super_admin 2FA enrollment state on prod before deploy:
SELECT u.id, u.email, u.two_factor_enabled
FROM users u
JOIN tenant_users tu ON tu.user_id = u.id
JOIN roles r ON r.id = tu.role_id
WHERE r.name = 'super_admin' AND tu.status = 'active';
```

- If `two_factor_enabled = false` for the super_admin: V-43's 2FA layer does nothing until they enroll via the dashboard (`POST /auth/2fa/setup` → `/auth/2fa/verify`). **Recommend enrolling before deploy** so the protection is live.
- The `V-43-mandatory-2fa` follow-up tightens this to mandatory (+ enrollment grace) once all super_admins are confirmed enrolled.

## Deploy posture

**Pure runtime card.** No platform or tenant migration. No new dependency (IP-allowlist helper is hand-rolled). Standard rolling deploy:

```bash
ssh servix-admin@194.163.158.70 << 'EOF'
  set -euo pipefail
  cd /home/servix-admin/servix
  # Optional: set ADMIN_IP_ALLOWLIST in the prod .env BEFORE deploy if you
  # want the allowlist active. Empty/unset = disabled (no IP restriction).
  #   ADMIN_IP_ALLOWLIST="<office IP>,<VPN CIDR>"
  sudo docker compose -f tooling/docker/docker-compose.prod.yml pull api-1 api-2
  sudo docker compose -f tooling/docker/docker-compose.prod.yml up -d --force-recreate --no-deps api-1
  sleep 10
  curl -fsS https://api.servi-x.com/api/v1/health | head -2
  sudo docker compose -f tooling/docker/docker-compose.prod.yml up -d --force-recreate --no-deps api-2
EOF
```

**⚠️ If you enable `ADMIN_IP_ALLOWLIST`:** make ABSOLUTELY sure the operator's own IP / VPN range is in the list, or you lock yourself out of the admin panel. Test from the allowed IP immediately after deploy. There is no backdoor — the only recovery is editing the prod `.env` and restarting.

**Any deploy window** — no breaking change for password-only super_admins (unless allowlist is enabled). 2FA-enabled super_admins now get the extra challenge step.

## Post-deploy smoke

```bash
# 1. Password-only super_admin (2FA disabled) → tokens directly.
curl -fsS -X POST https://api.servi-x.com/api/v1/admin/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"<super_admin>","password":"<pw>"}' | jq 'keys'
# expected: ["accessToken","refreshToken","user"]  (if 2FA disabled)
#        OR: ["requires2FA"]                         (if 2FA enabled)

# 2. If requires2FA — complete with the TOTP code.
CODE=$(oathtool --totp -b <TOTP_SECRET> | tail -1)
curl -fsS -X POST https://api.servi-x.com/api/v1/admin/auth/2fa/verify \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"<super_admin>\",\"password\":\"<pw>\",\"code\":\"$CODE\"}" | jq 'keys'
# expected: ["accessToken","refreshToken","user"]

# 3. Audit rows landed.
sudo docker exec -i servix-postgres psql -U servix -d servix_platform <<SQL
  SELECT action, new_values->>'ip', created_at
  FROM platform_audit_logs
  WHERE action LIKE 'admin_login%'
  ORDER BY created_at DESC LIMIT 5;
SQL

# 4. IP allowlist (only if ADMIN_IP_ALLOWLIST is set) — from a blocked IP:
#    expect 403; from an allowed IP: expect 200/requires2FA.
```

## Rollback

Pure code rollback. Re-pull the previous image tag:

```bash
PREV_TAG=$(cat /home/servix-admin/last-known-good-api.tag)
sudo IMAGE_TAG=$PREV_TAG docker compose -f tooling/docker/docker-compose.prod.yml \
  up -d --force-recreate --no-deps api-1 api-2
```

No DB state to undo. The new `admin_login_*` audit rows survive as inert history. Rollback re-exposes the password-only admin login (no 2FA, no IP allowlist, no audit) — acceptable as temporary incident response, not a long-term state.

## Caveats

1. **TwoFactorService dual-provided** in AdminModule (also in AuthModule). It's a zero-dependency stateless RFC-6238 calculator — a second instance is harmless. Chosen over a `@Global` wrapper (Phase A decision 2) to keep the change localized: no AuthModule edit, no new module file, no circular-import risk. Identical no-circular outcome.
2. **Blocked-IP attempts are NOT audit-rowed** — `PlatformAuditLog.userId` is NOT NULL (V-78) and the IP check fires before user resolution. Blocked IPs are `logger.warn`'d. The `V-43-audit-counter` follow-up adds a Prometheus counter (`servix_admin_login_blocked_ip_total`) via Engineer 1.
3. **Enforce-if-enabled, not mandatory** — see pre-deploy note. `V-43-mandatory-2fa` follow-up tightens once enrollment is confirmed.
4. **`ADMIN_IP_ALLOWLIST` has no Joi validation** — `configService.get('ADMIN_IP_ALLOWLIST', '')`, empty = disabled. A malformed entry fails closed (matches nothing — can only make the allowlist more restrictive). `V-43-env` follow-up adds boot-time CSV-format validation (Engineer 1 scope).
5. **IPv4-only allowlist** — the hand-rolled matcher gracefully no-matches IPv6 clients (they'd be denied if the allowlist is active). Admin allowlists are IPv4 in practice; IPv6 support would need a vetted library.
6. **V-25/V-41 full parity deferred** — admin login still lacks the IP-block + account-lockout layers that user `/auth/login` has (V-25). V-43 added only bcrypt timing equalization. Full parity tracked as `V-43-parity` — lower priority because `@RateLimit(5, 300)` + the tiny known super_admin set make brute-force/enumeration far less valuable.
