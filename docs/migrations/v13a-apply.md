# V-13a / A2-03 — OAuth account-takeover prevention runbook

**Severity:** HIGH (P1) — silent account linking via Google OAuth.
**Author:** Engineer 2 (Auth/Identity).
**Created:** 2026-05-25.
**Audit source:** `docs/principal-audit/synthesis-2026-05-14.md` V-13 / A2-03.
**Commit:** single — see `git log --oneline -1`.

## What this card does

Pre-V-13a, `auth.service.googleLogin` matched the incoming Google profile against the user table via `OR { googleId } { email }`. When a row matched by email but had no `googleId`, the service silently stamped the attacker's `googleId` onto the victim's user row and issued tokens. That is a textbook OAuth account-takeover:

1. Attacker creates a Google account for `victim@example.com` (Google does not verify ownership of emails on arbitrary domains; for self-hosted MX records this requires no special privilege).
2. Victim's SERVIX account exists with `authProvider='local'`, `googleId=null`, password-protected.
3. Attacker POSTs a valid Google idToken for `victim@example.com` to `POST /api/v1/auth/google`.
4. The service finds the victim by email and writes `googleId = <attacker's sub>`, `authProvider = 'google'`.
5. The attacker is now logged in as the victim. Every future `/auth/google` from the attacker logs them in as the victim. The victim's password keeps working but their account is hijacked.

After V-13a:

| Path | Pre-V-13a | Post-V-13a |
|---|---|---|
| Google profile matches by `googleId` | login, no mutation | login, no mutation (unchanged) |
| Google profile matches by `email` only (no `googleId`) | silent link → login | **REJECT** (401) + `auth_google_takeover_blocked` audit row |
| Google profile matches nothing | create new user | create new user (unchanged, `authProvider='google'`, `isEmailVerified` mirrors profile) |
| Authenticated user wants to link Google | _(no endpoint existed)_ | **`POST /auth/google/link`** — verifies idToken's email matches JWT user's email, atomically sets `googleId` via Prisma P2002-catching update, marks `authProvider='both'`, audits `auth_google_linked` |

Three new audit actions for forensic completeness:
- `auth_google_login` — success path (both fresh-create and returning-user). Parallels `auth.login`.
- `auth_google_linked` — `/auth/google/link` success.
- `auth_google_takeover_blocked` — the 401 path. `userId` is the **victim's** id; `newValues` carries `{ attemptedEmail, googleSub, existingUserAuthProvider, existingUserHasGoogleId, reason }`.

A new constants module `apps/api/src/core/auth/auth.constants.ts` exports `AUTH_PROVIDERS = { LOCAL, GOOGLE, BOTH }` (plain string union; no enum migration). Used at three sites: register (`LOCAL`), googleLogin fresh-create (`GOOGLE`), linkGoogle success (`BOTH`).

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

No client-visible breakage. The endpoint shape of `POST /auth/google` is unchanged — only the response on the previously-silent-link path changes from 200+tokens to 401 with a specific Arabic message.

## Pre-deploy investigation step (no fix — read-only)

Run this query against prod **before** deploying to scope the V-13a-backfill follow-up:

```sql
-- How many existing users carry a googleId while authProvider is still 'local'?
-- Pre-V-13a this state was reachable via the silent-link path: someone with a
-- valid Google idToken for an existing local-account email would have flipped
-- authProvider to 'google' (not 'local'), so 'local'+googleId pairs should
-- only arise if registration changed schema defaults at some point. Either way
-- the count tells us the scope of legacy state that V-13a-backfill must
-- investigate (link was legitimate OR was a takeover by the silent path).
SELECT COUNT(*) AS suspicious_link_count
FROM users
WHERE google_id IS NOT NULL
  AND auth_provider = 'local';

-- For investigation, sample 10 of them:
SELECT id, email, google_id, auth_provider, created_at, last_login_at
FROM users
WHERE google_id IS NOT NULL AND auth_provider = 'local'
ORDER BY created_at DESC
LIMIT 10;
```

- **Count = 0** → exploit was likely never used on prod (or the feature was never exercised). Mark V-13a-backfill closed-as-noop.
- **Count > 0** → file V-13a-backfill with the sample for manual review. Each row needs human judgement (compare email vs. googleId domain, check `last_login_at` patterns, optionally email the user to confirm). **Do NOT auto-revoke** — the rows might be legitimately linked accounts whose `authProvider` was never updated for reasons unrelated to attack.

This is investigation only — V-13a itself does NOT mutate the existing data.

## Post-deploy smoke

```bash
# 1. Returning-Google-user path (account already has googleId): should work.
curl -fsS -X POST https://api.servi-x.com/api/v1/auth/google \
  -H 'Content-Type: application/json' \
  -d '{"idToken":"<valid id token for an account with googleId set>"}'
# expected: 200 + { user, tokens, ... }

# 2. Takeover attempt path (email exists, no googleId on that user).
# Generate a valid idToken via the Google Sign-In playground for an email
# that has a local-only SERVIX account, then:
curl -s -o /dev/null -w '%{http_code}' -X POST https://api.servi-x.com/api/v1/auth/google \
  -H 'Content-Type: application/json' \
  -d '{"idToken":"<idToken for victim-but-not-linked email>"}'
# expected: 401

# 3. Verify the audit row landed.
sudo docker exec -i servix-postgres psql -U servix -d servix_platform <<SQL
  SELECT action, new_values->>'attemptedEmail', new_values->>'reason'
  FROM platform_audit_logs
  WHERE action = 'auth_google_takeover_blocked'
  ORDER BY created_at DESC LIMIT 1;
SQL
# expected: one row, reason = 'email_match_without_googleId'.

# 4. Link path (authenticated). After password-login as the victim:
TOKEN=<jwt access token from login>
curl -fsS -X POST https://api.servi-x.com/api/v1/auth/google/link \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"idToken":"<valid Google idToken for same email>"}'
# expected: 200 + { message: 'تم ربط حساب Google بنجاح.' }

# 5. Verify the link audit.
sudo docker exec -i servix-postgres psql -U servix -d servix_platform <<SQL
  SELECT action, new_values->>'newAuthProvider'
  FROM platform_audit_logs
  WHERE action = 'auth_google_linked'
  ORDER BY created_at DESC LIMIT 1;
SQL
# expected: newAuthProvider = 'both'.
```

## Rollback

Pure code rollback. Re-pull the previous image tag:

```bash
PREV_TAG=$(cat /home/servix-admin/last-known-good-api.tag)
sudo IMAGE_TAG=$PREV_TAG docker compose -f tooling/docker/docker-compose.prod.yml \
  up -d --force-recreate --no-deps api-1 api-2
```

No DB state to undo. The new audit rows survive rollback (they're just rows in `platform_audit_logs`); the new `auth.users.auth_provider='both'` rows from `/auth/google/link` calls between deploy and rollback also survive — they read fine on the pre-V-13a code which doesn't know about 'both' but treats it as a string anyway.

## Caveats

1. **No frontend touch.** No SERVIX-served app currently invokes `/auth/google`. The new takeover-block 401 has no UI to surface, and the new `/auth/google/link` endpoint has no caller. Both lie ready for when **V-13a-frontend** ships the Google sign-in button + "Link Google account" settings panel.
2. **Token verification path unchanged.** Both `/auth/google` and `/auth/google/link` still use `GoogleAuthService.verifyIdToken` which calls Google's tokeninfo endpoint. Switching to local JWKS signature verification via `google-auth-library` is a hardening improvement — **V-13a-verify** follow-up.
3. **No unlink endpoint.** `/auth/google/unlink` is a UX requirement, not security. Tracked as **V-13a-unlink**; ships once V-13a-frontend lands a settings panel that needs it.
4. **`phone: g-<sub.slice(0,10)>` placeholder unchanged.** Fresh Google-only users still get a synthetic phone. Google subs are 21-digit decimals; collisions on first-10-chars are theoretically possible (~one per 10^10 users). Out of scope; tracked as **V-13a-phone-placeholder**.
5. **`isEmailVerified` mirrors `profile.email_verified`** instead of being hardcoded true. Workspace accounts can report false; pre-V-13a treated everyone as verified. Behaviour change documented; affects whether new Google users can skip the OTP verification gate on first login.
6. **Race-free uniqueness via Prisma P2002.** `/auth/google/link` does NOT do a `findUnique({ googleId })` pre-check followed by `update`. It just attempts the update and catches Prisma's `P2002` error code, which fires on `googleId UNIQUE` violation. Eliminates the TOCTOU window between "is this googleId free?" and "claim it".
