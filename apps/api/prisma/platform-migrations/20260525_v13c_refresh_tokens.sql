-- ════════════════════════════════════════════════════════════════════
-- SERVIX — V-13c / A2-05 — Refresh token rotation + reuse detection
-- Source: docs/principal-audit/synthesis-2026-05-14.md (HIGH P1)
-- ────────────────────────────────────────────────────────────────────
-- Adds the refresh_tokens table that backs V-13c's opaque-token
-- rotation flow. Each login starts a new family (family_id UUID);
-- every /auth/refresh issues a successor row and marks the predecessor
-- revoked_at=NOW(), revoked_reason='rotated', replaced_by_token_id=
-- successor.id. Presenting a token whose row already has revoked_at
-- IS NOT NULL is treated as replay → cascade-revoke every row in the
-- same family + setPasswordChangedAt(user) (kills outstanding access
-- JWTs via V-14a) + audit log + Sentry warning.
--
-- Design notes:
--   - token_hash is SHA-256 hex (64 chars). The raw 32-byte hex token
--     is returned to the client once at issue time and never stored.
--   - family_id UUID is generated client-side at login (auth.service);
--     it ties every successor row in a rotation chain back to the
--     originating login event. Indexing (family_id, revoked_at)
--     supports the cascade revoke in one indexed query.
--   - replaced_by_token_id is a self-referencing FK that lets us
--     traverse the rotation chain forward in the rare audit case.
--     ON DELETE SET NULL avoids cascade-delete loops if rows ever
--     get GC'd individually.
--   - user_id FK is ON DELETE CASCADE — refresh tokens cannot
--     outlive their user. This matches PasswordReset semantics.
--   - ip_address (INET) + user_agent (VARCHAR 500) are kept for
--     forensic value during reuse-detection investigations; their
--     audit value was already demonstrated in V-78's PDPL m.12
--     retention discussion.
--
-- Coexistence with TokenBlacklist (V-13c-cleanup follow-up):
--   The existing token_blacklist table stays in place for V-13c.
--   Logout writes BOTH (revoke refresh_tokens row AND blacklist the
--   hash) as defence-in-depth during the cutover. A separate
--   V-13c-cleanup card (see engineer-2-database-auth.md) consolidates
--   to RefreshToken.revokedAt only after 30 days of clean operation.
--
-- Migration safety:
--   - Pure additive (CREATE TABLE + indices + FKs). No existing data
--     mutated. No locks on hot tables.
--   - The platform DB has no _prisma_migrations table (initialised
--     via db push). Applied manually via psql, same pattern as
--     V-18/V-23/V-44/V-78.
--   - Idempotent via IF NOT EXISTS where possible. Re-runs safe.
--
-- Breaking change at the application layer:
--   After deploy, every existing signed-JWT refresh token becomes
--   invalid (the refresh path no longer accepts signed JWTs — it
--   looks up rows by SHA-256 hash, and no rows exist yet). Users
--   experience: access JWT keeps working for up to 15min, then a
--   silent re-login. Coordinate deploy window with the owner; do
--   NOT deploy during peak hours. See docs/migrations/v13c-apply.md.
-- ════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS "refresh_tokens" (
  "id"                      UUID         NOT NULL DEFAULT gen_random_uuid(),
  "user_id"                 UUID         NOT NULL,
  "token_hash"              VARCHAR(64)  NOT NULL,
  "family_id"               UUID         NOT NULL,
  "issued_at"               TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "expires_at"              TIMESTAMPTZ  NOT NULL,
  "revoked_at"              TIMESTAMPTZ,
  "revoked_reason"          VARCHAR(30),
  "replaced_by_token_id"    UUID,
  "ip_address"              INET,
  "user_agent"              VARCHAR(500),
  CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "refresh_tokens_token_hash_key"
  ON "refresh_tokens"("token_hash");

CREATE INDEX IF NOT EXISTS "refresh_tokens_user_id_idx"
  ON "refresh_tokens"("user_id");

CREATE INDEX IF NOT EXISTS "refresh_tokens_family_id_revoked_at_idx"
  ON "refresh_tokens"("family_id", "revoked_at");

CREATE INDEX IF NOT EXISTS "refresh_tokens_expires_at_idx"
  ON "refresh_tokens"("expires_at");

ALTER TABLE "refresh_tokens"
  ADD CONSTRAINT "refresh_tokens_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "refresh_tokens"
  ADD CONSTRAINT "refresh_tokens_replaced_by_token_id_fkey"
  FOREIGN KEY ("replaced_by_token_id") REFERENCES "refresh_tokens"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;

-- ────────────────────────────────────────────────────────────────────
-- Verification queries (run after apply):
--
--   \d refresh_tokens
--     -- expect: 11 columns, 4 indices, 2 FKs (user_id CASCADE,
--     -- replaced_by_token_id SET NULL).
--
--   SELECT COUNT(*) FROM refresh_tokens;
--     -- expect: 0 (fresh table).
--
--   SELECT conname, confdeltype FROM pg_constraint
--   WHERE conrelid = 'refresh_tokens'::regclass AND contype = 'f';
--     -- expect: 2 rows
--     --   refresh_tokens_user_id_fkey                  | c  (cascade)
--     --   refresh_tokens_replaced_by_token_id_fkey     | n  (set null)
-- ────────────────────────────────────────────────────────────────────
