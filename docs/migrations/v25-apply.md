# V-25 / A2-09 — 2FA verify lockout parity runbook

**Severity:** HIGH (P1) — `/auth/2fa/verify-login` had no IP-block, no account-lockout, no fail counter.
**Author:** Engineer 2 (Auth/Identity).
**Created:** 2026-05-26.
**Audit source:** `docs/principal-audit/synthesis-2026-05-14.md` V-25 / A2-09.
**Commit:** single — see `git log --oneline -1`.

## What this card does

Pre-V-25, `auth.service.verify2FALogin` was protected only by the controller's `@RateLimit(10, 60)` decorator. Three concrete gaps:

| Gap | Pre-V-25 | Threat |
|---|---|---|
| No IP-block check | `_ip` parameter was discarded (underscored) | Distributed brute-force from a botnet unhindered beyond per-IP rate-limit. |
| No account-lockout check | A user whose account was locked from 10+ login fails could still attempt 2FA verify | Attacker who burned the login counter pivots to `/2fa/verify-login` unhindered. |
| No fail counter on invalid code | `throw 'رمز التحقق غير صحيح'` incremented nothing | Unlimited TOTP guesses (subject only to 10/min/IP). Each attempt also burned ~150ms of bcrypt CPU (DoS load). |

After V-25, `verify2FALogin` mirrors `login` (auth.service.ts:212-271) exactly:

```
1. IP-block gate          (fast-reject blocked IPs before any DB hit)
2. User lookup            (unknown user → IP counter only, parity with login)
3. Account-lock gate      (fast-reject locked accounts BEFORE bcrypt)
4. bcrypt password compare
5. 2FA-enabled check      (misconfigured account — no counter increment)
6. TOTP verify
7. fail/success counters  (shared with login; transition SMS + audit)
```

Counters are **shared** with login (same Redis keyspace `LOGIN_FAIL_IP_PREFIX` / `LOGIN_FAIL_ACCOUNT_PREFIX`). An attacker pivoting from password-brute-force to 2FA-brute-force on the same account accumulates against the same threshold (`LOGIN_ACCOUNT_LOCK_THRESHOLD = 10`, 24h TTL). A legitimate user typo-ing 4× password + 6× TOTP ends up locked at 10 — acceptable trade-off for the cumulative attacker tracking.

Both password-fail and code-fail paths inside `verify2FALogin` increment the counters via the new private `handle2FAFailure(user, ip, reason)` helper. The `reason` field on the audit row (`'password_invalid' | 'code_invalid' | 'account_locked'`) distinguishes the failure modes post-incident without needing 3 separate audit actions.

Three new audit actions:
- `auth_2fa_verify_failed` — every fail (password, code, account_locked). `newValues.reason` carries the distinction.
- `auth_2fa_lockout_triggered` — transition-only (the call that crosses threshold 10). Includes `triggeringReason`, `accountFailCount`, `lockoutTtlSeconds`.
- `auth_2fa_verify_success` — every success. Parity with `auth.login`.

All audit writes are fire-and-forget (`.catch + logger.warn`) — audit slowness must never delay the hot path or surface as 500.

SMS notification on the lock transition mirrors `login.line:259-265` — exact same message, same `user.phone` recipient, transition-only (~1 SMS per 24h lockout cycle even under sustained brute-force).

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

**None at the API contract level.** `POST /api/v1/auth/2fa/verify-login` request/response shapes are unchanged. The new behaviour:
- A user who was already locked from login fails (10+) will now also be blocked at `/2fa/verify-login`. Pre-V-25 they could still complete 2FA verify (a bug). Post-V-25 they get the same lockout message as on the login path. Same UX, same operator unlock path (Support resets via admin endpoint or waits 24h).
- A user who typos their 2FA code many times now contributes to the same per-account counter as their login fails. 10 cumulative fails → 24h lockout. **This is new behaviour for users who legitimately fat-finger TOTP codes** — operator should expect a small uptick in lockout support requests in the first week. Document in the support runbook.

**Audit volume.** The new `auth_2fa_verify_success` audit row fires on EVERY successful 2FA login. At current 2FA enrollment rate (~10% of users) the row volume should be ~10% of `auth.login` volume — negligible. `auth_2fa_verify_failed` similarly bounded by attacker traffic.

**Existing counter state.** No reset on deploy. Any user with an in-flight login-fail counter inherits it for `/2fa/verify-login` immediately. Acceptable — V-25 deliberately shares the counter.

## Post-deploy smoke

```bash
# Pre-req: a test user with 2FA enabled. If you don't have one:
#   - register, verify email, setup 2FA, save the TOTP secret.

# 1. Valid 2FA login should still work end-to-end.
TOTP_CODE=$(oathtool --totp -b <TOTP_SECRET> | tail -1)
curl -fsS -X POST https://api.servi-x.com/api/v1/auth/2fa/verify-login \
  -H 'Content-Type: application/json' \
  -d "{\"emailOrPhone\":\"<test email>\",\"password\":\"<correct>\",\"code\":\"$TOTP_CODE\"}"
# expected: 200 + { user, tokens }

# 2. Verify auth_2fa_verify_success audit row landed.
sudo docker exec -i servix-postgres psql -U servix -d servix_platform <<SQL
  SELECT action, new_values->>'ip', created_at
  FROM platform_audit_logs
  WHERE action = 'auth_2fa_verify_success'
  ORDER BY created_at DESC LIMIT 1;
SQL

# 3. Invalid TOTP code → 400 + fail audit.
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://api.servi-x.com/api/v1/auth/2fa/verify-login \
  -H 'Content-Type: application/json' \
  -d '{"emailOrPhone":"<test email>","password":"<correct>","code":"000000"}'
# expected: 400

sudo docker exec -i servix-postgres psql -U servix -d servix_platform <<SQL
  SELECT action, new_values->>'reason', new_values->>'accountFailCount'
  FROM platform_audit_logs
  WHERE action = 'auth_2fa_verify_failed'
  ORDER BY created_at DESC LIMIT 1;
  -- expect: reason='code_invalid', accountFailCount=1
SQL

# 4. Confirm Redis counter incremented.
sudo docker exec -i servix-redis redis-cli GET "servix:login_fail_account:<test_user_uuid>:count"
# expected: matches the audit accountFailCount.

# 5. Reset the counter so the test user isn't accidentally locked:
sudo docker exec -i servix-redis redis-cli DEL \
  "servix:login_fail_account:<test_user_uuid>" \
  "servix:login_fail_account:<test_user_uuid>:count"
```

## Rollback

Pure code rollback. Re-pull the previous image tag:

```bash
PREV_TAG=$(cat /home/servix-admin/last-known-good-api.tag)
sudo IMAGE_TAG=$PREV_TAG docker compose -f tooling/docker/docker-compose.prod.yml \
  up -d --force-recreate --no-deps api-1 api-2
```

**No DB state to undo.** The new audit rows (`auth_2fa_verify_*` actions) survive rollback as inert history. Any pre-rollback Redis counter values are still consumed by the legacy `login` path unchanged.

The only operational impact of rollback: `/2fa/verify-login` returns to its pre-V-25 unprotected state. Acceptable as a temporary measure during an incident; should not be the long-term state.

## Caveats

1. **Counter conflation between login and 2FA fails.** A user with 4 password typos + 6 TOTP typos ends up locked. Acceptable trade-off for cumulative attacker tracking; documented above. Operators seeing first-week lockout uptick should advise users that fat-fingering their TOTP also counts.
2. **SMS DoS-via-attacker** — mitigated by transition-only firing. Worst case: 1 SMS per 24h lockout cycle per victim. Tracked as `V-25-sms-cost` low-priority follow-up if owners want explicit SMS-budget monitoring.
3. **No frontend change.** No SERVIX-served app surfaces the new lockout message yet (`apps/dashboard/src` doesn't render 2FA verify UI). When the UI lands, it can read the existing 401 body for the localized message.
4. **DTO replacement deferred to V-60.** The controller still uses `@Body() body: { emailOrPhone, password, code }` inline type. V-60 will introduce `Verify2FALoginDto` with class-validator. Not in V-25 scope.
5. **Misconfigured-2FA path** (account where `twoFactorEnabled=false` but caller hits the verify endpoint) returns `BadRequest('التحقق الثنائي غير مفعل')` without incrementing counters. Intentional: an attacker could otherwise lock out a user by disabling 2FA out-of-band then probing this endpoint.
