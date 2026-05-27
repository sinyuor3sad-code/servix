# V-41 / A2-15 — Email enumeration hardening runbook

**Severity:** P2 — message + timing differentials on auth paths enabled email enumeration.
**Author:** Engineer 2 (Auth/Identity).
**Created:** 2026-05-27.
**Audit source:** `docs/principal-audit/synthesis-2026-05-14.md` V-41 / A2-15.
**Commit:** single — ~30 LOC runtime + ~280 LOC tests + docs.

## What this card does

Pre-V-41 the auth surface leaked email existence via two distinct side channels:

| Vector | Pre-V-41 | Post-V-41 |
|---|---|---|
| `login` timing | user-not-found ~10ms · wrong-password ~150ms (bcrypt cost). **150ms delta detectable in single request over Riyadh DC's ~5-50ms noise floor.** | Both paths run bcrypt (real hash vs `DUMMY_BCRYPT_HASH`). Delta < ~10ms. |
| `verify2FALogin` timing | Same 150ms delta on the user-lookup branch (V-25 didn't address timing). | Same fix as login — dummy bcrypt on user-not-found. |
| `forgotPassword` timing | found-user fires `passwordReset.create` + `mailService.send` + `smsService.send` (~1-3 seconds of network IO). not-found returns in ~10ms. **~2-second delta enumerates emails in single request.** | not-found path sleeps `crypto.randomInt(800, 1501)` ms (mimics observed prod mail+SMS p50). |
| Message uniformity | `login`/`verify2FALogin` already used `'بيانات الدخول غير صحيحة'` uniformly on user-not-found AND wrong-password. ✓ | Locked in by regression-guard test #6. |

The `DUMMY_BCRYPT_HASH` constant is computed at module init via `hashSync('placeholder', BCRYPT_ROUNDS)` — auto-syncs with the cost factor if `BCRYPT_ROUNDS` ever changes. The compare against this hash always returns false; only its ~150ms CPU cost matters.

The jitter range (800-1500ms) is matched to observed mail+SMS p50 in prod. The randomness source is `crypto.randomInt` per V-13b's `no-math-random-in-security` ESLint rule.

## Explicit out-of-scope (accepted UX trade-offs)

The following enumeration vectors are NOT addressed by V-41 because closing them would break legitimate UX:

| Vector | Why kept | Follow-up |
|---|---|---|
| `login` "account locked" message | User needs to know to contact support (V-25 decision) | none |
| `login` "verify your email" message | User needs to check inbox | none |
| `verify2FALogin` "2FA not enabled" message | Misconfigured-account UX (V-25 decision 5) | none |
| `/auth/resend-otp` 4-message variance | User needs to know "already verified" vs "wait 60s" vs "sent" | `V-41b-resend-otp-uniform` |
| `/auth/google` takeover-block message | V-13a explicitly chose UX over enumeration for the link flow | none |
| Side-effect: no email arrives at non-existent address | Fundamentally unfixable | accepted threat model |

These are documented in the commit body so future audits don't re-litigate them.

## Deploy posture

**Pure runtime card.** No platform or tenant migration. No new dependency (`bcryptjs.hashSync` is already imported elsewhere). Standard rolling deploy:

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

**Any deploy window.** No breaking changes. User-facing latency observations:

- `POST /auth/login` with INVALID email: now ~150ms slower than pre-V-41 (matches valid-email-wrong-password latency, which itself is unchanged).
- `POST /auth/2fa/verify-login` with INVALID email: same +150ms.
- `POST /auth/forgot-password` with INVALID email: now ~800-1500ms slower (matches found-user latency).

These deltas are intentional. They will move the p95 of the affected endpoints up; budget accordingly if SLOs are tight.

**Boot-time cost:** `hashSync` at module init adds ~150ms to API startup. Invisible at request time; observable only in cold-start metrics.

## Post-deploy smoke

```bash
# 1. Login timing parity — invalid email should take ~as long as valid email + wrong password.
time curl -s -o /dev/null -X POST https://api.servi-x.com/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"emailOrPhone":"nobody-at-all@example.com","password":"anything"}'
# Pre-V-41: ~50ms total.    Post-V-41: ~200ms total (bcrypt now runs).

time curl -s -o /dev/null -X POST https://api.servi-x.com/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"emailOrPhone":"<known email>","password":"deliberately-wrong"}'
# ~200ms (unchanged from pre-V-41).

# 2. Message uniformity — both should return identical body.
A=$(curl -fsS -X POST https://api.servi-x.com/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"emailOrPhone":"nobody-at-all@example.com","password":"x"}' | jq -r '.error.message // .message // .')
B=$(curl -fsS -X POST https://api.servi-x.com/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"emailOrPhone":"<known email>","password":"wrong"}' | jq -r '.error.message // .message // .')
test "$A" = "$B" && echo "MESSAGE UNIFORMITY ✓" || echo "DRIFT — investigate"

# 3. forgotPassword jitter — invalid email should now take 800-1500ms.
time curl -s -o /dev/null -X POST https://api.servi-x.com/api/v1/auth/forgot-password \
  -H 'Content-Type: application/json' \
  -d '{"email":"nobody-at-all@example.com"}'
# Post-V-41: ~800-1500ms (matches found-user mail+SMS latency).
```

## Rollback

Pure code rollback. Re-pull the previous image tag:

```bash
PREV_TAG=$(cat /home/servix-admin/last-known-good-api.tag)
sudo IMAGE_TAG=$PREV_TAG docker compose -f tooling/docker/docker-compose.prod.yml \
  up -d --force-recreate --no-deps api-1 api-2
```

No DB state to undo. The DUMMY_BCRYPT_HASH disappears with the runtime, no orphan data. forgotPassword's setTimeout effect is purely in-memory.

## Caveats

1. **Mitigation is statistical, not absolute.** The jitter on forgotPassword raises the bar from "single-request leak" to "needs N samples + statistical analysis to distinguish." Sophisticated attackers with enough samples could still distinguish (jitter doesn't perfectly mimic real-IO variance shape). Adequate for P2; would need cryptographic constant-time mitigations for higher severity.
2. **`DUMMY_BCRYPT_HASH` is module-scoped (not exported).** Test #1-3 verify the behavior by spying on `bcrypt.compare` via the CJS require'd module object — confirming the call happens, not the specific hash value.
3. **Locked-account / email-not-verified message leaks remain** by design (V-14 / V-25 documented UX trade-offs). An attacker hitting these specific branches still learns the account exists. Note: they need 10+ failed logins to trigger locked, OR a pre-existing unverified account — both narrow attack windows.
4. **`/auth/resend-otp` 4-message variance kept** as accepted UX trade-off — tracked as `V-41b-resend-otp-uniform` follow-up if owner wants to revisit.
5. **No enumeration audit log** in V-41. An "N invalid email attempts from same IP in M minutes" signal would help ops spot enumeration campaigns. Tracked as `V-41-audit` follow-up; defer until rate-limit telemetry justifies the work.
