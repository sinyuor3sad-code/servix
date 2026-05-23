# V-13b / A2-04 — OTP entropy fix runbook

**Severity:** HIGH (P1) — OTP predictability.
**Author:** Engineer 2 (Auth/Identity).
**Created:** 2026-05-23.
**Audit source:** `docs/principal-audit/synthesis-2026-05-14.md` V-13 / A2-04.

## What this card does

Pre-V-13b, two OTP generators used `Math.random()`:

| Path | Code (pre-V-13b) | Length | Risk |
|---|---|---|---|
| `auth.service.generateOtpCode()` (line 809) | `Math.floor(100000 + Math.random() * 900000)` | 6 digits | Email-OTP for signup verification |
| `booking.service.sendOtp()` (line 368) | `String(Math.floor(1000 + Math.random() * 9000))` | 4 digits | Public booking OTP (no-auth surface) |

V8's `Math.random()` is backed by xorshift128+, a deterministic PRNG seeded once per process. Observing a handful of consecutive outputs allows full state reconstruction — a fatal property for any code an attacker can request via API.

After V-13b:
- Both call sites use `crypto.randomInt(min, max)` from Node's `crypto` module (backed by `/dev/urandom` on Linux). Format and bounds are byte-for-byte identical from the client's perspective.
- A new ESLint rule `@servix/servix/no-math-random-in-security` at `error` severity prevents future regressions across `apps/api/src`. 7 legitimate non-security `Math.random` sites (anti-ban jitter, AI typing delays, file-upload uniqueness suffix, iCal UID, fake backup sizes) carry `// non-security` annotations consumed by the rule.

## Deploy posture

Pure code change. Standard rolling deploy:

```bash
ssh servix-admin@194.163.158.70 << 'EOF'
  cd /home/servix-admin/servix
  sudo docker compose -f tooling/docker/docker-compose.prod.yml pull api-1 api-2
  sudo docker compose -f tooling/docker/docker-compose.prod.yml up -d --force-recreate --no-deps api-1
  sleep 10
  curl -fsS https://api.servi-x.com/api/v1/health | head -2
  sudo docker compose -f tooling/docker/docker-compose.prod.yml up -d --force-recreate --no-deps api-2
EOF
```

No client-visible behaviour change. OTPs remain 6 digits (email) and 4 digits (booking); only the generator changes.

## Pre-conditions

- [ ] Backup verification (standard discipline; no schema change).
- [ ] Redis healthy (the OTP storage path was untouched; this is a sanity check, not a dependency).

## Step 1 — Manual smoke (low-stakes, low-noise)

Triggering an OTP write is the smoke. A single email-OTP request through the existing signup or login-OTP flow confirms the new path runs without error:

```bash
# Send the OTP (real account; the body shape is whatever the live endpoint expects).
curl -fsS -X POST https://api.servi-x.com/api/v1/auth/send-otp \
  -H 'Content-Type: application/json' \
  -d '{"email":"<test account email>"}'
# expected: HTTP 200, { "message": "..." } shape
```

Check the api-1 logs for the expected `[OTP] code generated…` log line (or whatever the existing logger emits). No `crypto` errors should appear.

For the booking OTP, repeat against `/api/v1/booking/otp/send` (or the existing public path) with a test phone number.

## Rollback

`git revert` the V-13b commit. The behaviour difference is "generator switched from Math.random to crypto.randomInt"; reverting restores the predictable path. No persistent state needs cleanup — OTPs in Redis are short-TTL (~5 min) and will roll over naturally.

## Caveats

1. **Booking OTP length is still 4 digits.** crypto.randomInt closes the predictability gap but not the search space. The rate-limit at `cacheService.canSendBookingOtp` is what makes 4 digits acceptable today. Tracked as **V-13b-length** in `engineer-2-database-auth.md`.
2. **ESLint rule annotation strictness.** The rule's `ANNOTATION_RE` requires the literal `// non-security` token at the start of a `//` comment (or anywhere on the same line as the call, since end-of-line position varies). Near-misses like `// non-securityish` or `// explanation about non-security` do NOT satisfy the rule. This is intentional — the annotation must be an unambiguous opt-out, not a substring match in a sentence.
3. **Frontend / load-test sites untouched.** `apps/dashboard`, `apps/booking`, `apps/admin`, `apps/landing` carry many `Math.random()` calls for UI animations and ephemeral client-side ids; these are not security-relevant and not in this card's scope. `tooling/k6/*` and `tooling/load-tests/*` use `Math.random` for synthetic data generation — also out of scope.
4. **2FA TOTP secrets and reset tokens were already secure.** `two-factor.service` uses `crypto.randomBytes(20)`, `auth.service.forgotPassword` uses `v4()` from the `uuid` lib (backed by `crypto.randomBytes`), and `admin.service.sendPasswordResetLink` uses `crypto.randomBytes(32)`. No reset-token regressions to fix; only the two OTP generators were on `Math.random`.
