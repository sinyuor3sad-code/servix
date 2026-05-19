-- ════════════════════════════════════════════════════════════════════
-- SERVIX — V-78 / A1-008 — PlatformAuditLog FK: SET NULL → RESTRICT
-- Source: docs/principal-audit/synthesis-2026-05-14.md (HIGH P1)
-- ────────────────────────────────────────────────────────────────────
-- Prevents tenant hard-delete from destroying audit history.
-- The current FK is ON DELETE SET NULL, which means deleting a tenant
-- silently strips tenant_id from every audit row referencing it —
-- breaking the "who did what" trail required by PDPL article 12 and
-- SOC2 audit controls.
--
-- Design notes:
--   - tenant_id stays NULLABLE. 178/214 audit rows on prod already
--     have tenant_id IS NULL — they are genuine system-level events
--     (login attempts, platform admin actions). Nullability is not
--     a "no tenant deleted" signal.
--   - No hard-delete of tenants exists anywhere in apps/api/src/** or
--     tooling/scripts/**. Soft-delete pattern is the supported path:
--     account.service / admin.service / data-rights.service set
--     status='pending_deletion' + pendingDeletionAt. The Restrict
--     here is a future-defence guard.
--   - PDPL retention overrides erasure for audit logs — already
--     declared to users via data-rights.service: retainedData includes
--     "سجلات التدقيق (متطلب تنظيمي)". This change makes the database
--     enforce what the API already promised.
--
-- ALTER … DROP CONSTRAINT + ADD CONSTRAINT inside a single transaction
-- is the standard pattern; AccessExclusiveLock is brief (table holds
-- 214 rows on prod).
--
-- The platform DB has no _prisma_migrations table (initialised via
-- db push). Applied manually via psql, same as the V-18/V-23/V-44
-- platform migrations.
-- ════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE "platform_audit_logs"
  DROP CONSTRAINT IF EXISTS "platform_audit_logs_tenant_id_fkey";

ALTER TABLE "platform_audit_logs"
  ADD CONSTRAINT "platform_audit_logs_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON UPDATE CASCADE ON DELETE RESTRICT;

COMMIT;

-- ────────────────────────────────────────────────────────────────────
-- Rollback (manual; restores the previous SET NULL behaviour, which
-- breaks PDPL/SOC2 retention — only do this if a regression is found):
--
--   BEGIN;
--     ALTER TABLE "platform_audit_logs"
--       DROP CONSTRAINT "platform_audit_logs_tenant_id_fkey";
--     ALTER TABLE "platform_audit_logs"
--       ADD CONSTRAINT "platform_audit_logs_tenant_id_fkey"
--       FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
--       ON UPDATE CASCADE ON DELETE SET NULL;
--   COMMIT;
-- ════════════════════════════════════════════════════════════════════
