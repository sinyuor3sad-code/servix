-- ════════════════════════════════════════════════════════════════════
-- SERVIX — V-24-audit-completion — password_resets.initiated_by (platform)
-- Source: docs/principal-audit/execution/engineer-2-database-auth.md (V-24-audit-completion)
-- ────────────────────────────────────────────────────────────────────
-- Adds an initiated_by discriminator so auth.service.resetPassword can emit
-- the correct completion/failure audit action for the flow that created the
-- reset:
--   'self_serve' → user via /auth/forgot-password   (auth_password_reset_*)
--   'admin'      → super_admin via the admin panel    (admin_password_reset_*)
--
-- VARCHAR(20) NOT NULL DEFAULT 'self_serve' (matches Prisma
-- `initiatedBy String @default("self_serve") @db.VarChar(20)` — a DB-level
-- default, KEPT, so prisma db push sees no drift). The DEFAULT also backfills
-- every existing row to 'self_serve' on ADD COLUMN: correct, since every
-- pre-migration reset row was created by the self-serve forgotPassword flow
-- (the admin flow only started writing initiated_by='admin' with this card).
--
-- The platform DB has no _prisma_migrations table (initialised via db push),
-- so this is a manual SQL migration applied via psql.
--
-- Usage:
--   psql "$PLATFORM_DATABASE_URL" \
--     -f apps/api/prisma/platform-migrations/20260602_v24_audit_completion_initiated_by.sql
-- ════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE "password_resets"
  ADD COLUMN "initiated_by" VARCHAR(20) NOT NULL DEFAULT 'self_serve';

COMMIT;

-- ────────────────────────────────────────────────────────────────────
-- Rollback (manual):
--   BEGIN;
--     ALTER TABLE "password_resets" DROP COLUMN "initiated_by";
--   COMMIT;
-- ════════════════════════════════════════════════════════════════════
