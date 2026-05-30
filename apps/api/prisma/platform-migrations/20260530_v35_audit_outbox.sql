-- ════════════════════════════════════════════════════════════════════
-- SERVIX — V-35a — Audit outbox staging table (platform)
-- Source: docs/principal-audit/synthesis-2026-05-14.md (V-35 / A2-18)
-- ────────────────────────────────────────────────────────────────────
-- Transactional-outbox buffer so an audit event is never silently lost.
-- Writers persist a row here (V-35b: optionally inside their business tx
-- via the log(data, tx?) overload); AuditOutboxProcessor (V-35b, BullMQ)
-- drains pending rows into platform_audit_logs with at-least-once delivery
-- + retry, surfaced via servix_audit_outbox_lag_seconds.
--
-- No FKs by design: the outbox is a lightweight, always-writable buffer.
-- Referential integrity (user_id, tenant_id) is enforced on the terminal
-- platform_audit_logs insert during drain, so a transient/invalid FK never
-- blocks (or rolls back) the writer's business transaction. Contrast with
-- account_unlocks (V-40a) / two_factor_backup_codes (V-42), which ARE
-- FK-bound because they sit on a read/auth hot path.
--
-- V-35a ships the schema only; the table is inert until V-35b wires the
-- runtime + worker. V-35 closes (and pushes) when V-35a + V-35b are both done.
--
-- Column shapes / constraint names match Prisma's @@map output (no drift).
--
-- The platform DB has no _prisma_migrations table (initialised via db push),
-- so this is a manual SQL migration applied via psql.
--
-- Usage:
--   psql "$PLATFORM_DATABASE_URL" \
--     -f apps/api/prisma/platform-migrations/20260530_v35_audit_outbox.sql
-- ════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS "platform_audit_outbox" (
  "id"           UUID         NOT NULL,
  "tenant_id"    UUID,
  "user_id"      UUID         NOT NULL,
  "action"       VARCHAR(50)  NOT NULL,
  "entity_type"  VARCHAR(50)  NOT NULL,
  "entity_id"    UUID         NOT NULL,
  "old_values"   JSONB,
  "new_values"   JSONB,
  "ip_address"   VARCHAR(45),
  "user_agent"   TEXT,
  "status"       VARCHAR(20)  NOT NULL DEFAULT 'pending',
  "attempts"     INTEGER      NOT NULL DEFAULT 0,
  "last_error"   TEXT,
  "audit_log_id" UUID,
  "created_at"   TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"   TIMESTAMPTZ  NOT NULL,
  "processed_at" TIMESTAMPTZ,
  CONSTRAINT "platform_audit_outbox_pkey" PRIMARY KEY ("id")
);

-- Serves the drain query (status='pending' ORDER BY created_at) and the lag
-- gauge: now() - min(created_at) WHERE status='pending'. Plain CREATE INDEX
-- (not CONCURRENTLY): the table is created empty in the same tx, so the
-- build is instant.
CREATE INDEX IF NOT EXISTS "platform_audit_outbox_status_created_at_idx"
  ON "platform_audit_outbox" ("status", "created_at");

COMMIT;

-- ────────────────────────────────────────────────────────────────────
-- Rollback (manual):
--   BEGIN;
--     DROP TABLE IF EXISTS "platform_audit_outbox";
--   COMMIT;
-- ════════════════════════════════════════════════════════════════════
