# V-60 / A5-006 — Auth body DTO validation runbook

**Severity:** P2 — auth endpoints accepted unvalidated request payloads.
**Author:** Engineer 2 (Auth/Identity).
**Created:** 2026-05-27.
**Audit source:** `docs/principal-audit/synthesis-2026-05-14.md` V-60 / A5-006.
**Commit:** single — see `git log --oneline -1`.

## What this card does

Pre-V-60, 7 auth endpoints used `@Body() body: { ... }` inline TypeScript types. NestJS's global `ValidationPipe` ignores inline literals (no class metadata to enforce against), so these endpoints accepted ANY JSON payload — attackers could pass extra fields, wrong types, or missing required fields without triggering 400.

After V-60, all 7 endpoints use class-validator DTOs and inherit the existing strict `ValidationPipe` config (`whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: true }`) from `main.ts:103-110`:

| # | Endpoint | DTO (new) | Validation rules |
|---|---|---|---|
| 1 | `POST /auth/2fa/verify-login` | `Verify2FALoginDto` | emailOrPhone IsString, password IsString, code Length(6,6) Matches(/^\d{6}$/) |
| 2 | `POST /auth/verify-reset-token` | `VerifyResetTokenDto` | token IsString |
| 3 | `POST /auth/verify-otp` | `VerifyOtpDto` | email IsEmail, code Length(6,6) Matches(/^\d{6}$/) |
| 4 | `POST /auth/resend-otp` | `ResendOtpDto` | email IsEmail |
| 5 | `POST /auth/2fa/verify` | `Verify2FADto` | code Length(6,6) Matches(/^\d{6}$/) |
| 6 | `DELETE /auth/2fa` | `Disable2FADto` | password IsString (lenient — see note 3) |
| 7 | `POST /auth/google` | `GoogleLoginDto` | idToken IsString |

All DTOs carry `@ApiProperty` annotations for Swagger UI documentation. Arabic error messages match the existing DTO convention (LoginDto, RegisterDto).

## Deploy posture

**Pure runtime card.** No platform or tenant migration. No new dependency (`class-validator` + `class-transformer` already pinned in apps/api). Standard rolling deploy:

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

**Behavior change:** clients posting extra fields to these 7 endpoints will now receive `400 Bad Request` instead of being silently ignored. This is the V-60 contract — `forbidNonWhitelisted: true` was already configured but ineffective on inline-body endpoints.

**Frontend compatibility audit (V-60 Phase A · section e):** all 3 SERVIX frontend callers of these endpoints send exactly the new DTO shape — verified via grep:

| Endpoint | Frontend call site | Payload | Compatible? |
|---|---|---|---|
| `/auth/verify-reset-token` | `dashboard/.../reset-password/page.tsx:28` | `{ token }` | ✓ |
| `/auth/verify-otp` (×2) | `dashboard/services/auth.service.ts:116` + `employees/[id]/page.tsx:98` | `{ email, code }` | ✓ |
| `/auth/resend-otp` (×3) | `dashboard/services/auth.service.ts:119` + `employees/[id]/page.tsx:87,111` | `{ email }` | ✓ |
| `/auth/2fa/verify-login` | no frontend caller | — | n/a |
| `/auth/2fa/verify` | no frontend caller | — | n/a |
| `DELETE /auth/2fa` | no frontend caller | — | n/a |
| `/auth/google` | no frontend caller | — | n/a |

**Zero frontend changes needed.** External / mobile / third-party callers (if any) sending extra fields will start receiving 400 — coordinate with Slack channel #api-changes pre-deploy.

## Post-deploy smoke

```bash
# 1. Happy path — existing frontend flow still works.
curl -fsS -X POST https://api.servi-x.com/api/v1/auth/resend-otp \
  -H 'Content-Type: application/json' \
  -d '{"email":"<test account email>"}'
# expected: 200 + { "message": "..." }

# 2. Extra-field rejection — new V-60 behavior.
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://api.servi-x.com/api/v1/auth/resend-otp \
  -H 'Content-Type: application/json' \
  -d '{"email":"<test account email>","bypass":"yes"}'
# expected: 400

# 3. Missing required — class-validator triggers.
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://api.servi-x.com/api/v1/auth/resend-otp \
  -H 'Content-Type: application/json' \
  -d '{}'
# expected: 400

# 4. TOTP format enforcement — non-6-digit code rejected at DTO layer.
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://api.servi-x.com/api/v1/auth/2fa/verify-login \
  -H 'Content-Type: application/json' \
  -d '{"emailOrPhone":"x@x.com","password":"X","code":"12345"}'
# expected: 400 (code length 5)

# 5. Invalid email format on resend-otp.
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://api.servi-x.com/api/v1/auth/resend-otp \
  -H 'Content-Type: application/json' \
  -d '{"email":"not-an-email"}'
# expected: 400
```

## Rollback

Pure code rollback. Re-pull the previous image tag:

```bash
PREV_TAG=$(cat /home/servix-admin/last-known-good-api.tag)
sudo IMAGE_TAG=$PREV_TAG docker compose -f tooling/docker/docker-compose.prod.yml \
  up -d --force-recreate --no-deps api-1 api-2
```

No DB state to undo, no migration to reverse. Clients depending on extra-field acceptance (if any) regain the lax behavior immediately.

## Caveats

1. **No business-rule changes.** V-60 DTOs reflect the EXISTING contract — every constraint mirrors what the service already enforces (TOTP 6-digit per `TwoFactorService.DIGITS=6`, OTP 6-digit per V-13b, email format implicit in service lookups). No new accept/reject decisions.
2. **TOTP code format is strict 6-digit.** Verified at `two-factor.service.ts:36` (`token.length !== this.DIGITS` rejects non-6). The DTO surfaces this constraint a layer earlier — saves a round-trip to `verifyToken` for malformed inputs.
3. **`Disable2FADto.password` is lenient** — `@IsString + @IsNotEmpty` only, no MinLength or strong-password regex. The bcrypt compare against the user's current password is the actual authorization gate; the DTO just confirms a non-empty string. A user with a pre-strength-rules legacy password must still be able to disable 2FA.
4. **`ResendOtpDto` and `GoogleLoginDto` are byte-identical to existing DTOs** (`ForgotPasswordDto`, `LinkGoogleDto` respectively). Kept as separate classes per V-60 decision #1 for Swagger UI clarity and future-divergence safety. Cross-reference comments in each new file point to the duplicate.
5. **No audit log on validation failure.** `ValidationPipe` throws `BadRequestException` BEFORE the controller method runs, so existing `auditService.log` calls inside services don't fire. Tracked as `V-60-audit-fail` follow-up if owners want forensic logging of payload-shape attacks (a global exception filter would surface them).
6. **`apps/api/src/core/admin/`** has 3 inline-body endpoints of its own (`resetUserPassword`, `updateUserStatus`, `changeUserRole`). Out of V-60 scope per CLAUDE.md — Engineer 3 V-53.
