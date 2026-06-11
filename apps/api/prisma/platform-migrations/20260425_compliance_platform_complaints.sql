-- ════════════════════════════════════════════════════════════════════
-- SERVIX — Compliance migration (Saudi Ministry of Commerce)
-- Adds platform_complaints table for the public /complaints workflow.
-- ────────────────────────────────────────────────────────────────────
-- Apply against the PLATFORM database only:
--   PLATFORM_DATABASE_URL=postgres://… \
--     psql "$PLATFORM_DATABASE_URL" \
--          -f prisma/platform-migrations/20260425_compliance_platform_complaints.sql
--
-- Or, if the platform schema is managed via `prisma db push`:
--   npx prisma db push --schema=./prisma/platform.prisma --accept-data-loss=false
--
-- This script is additive and idempotent (uses IF NOT EXISTS).
-- ════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  CREATE TYPE "ComplaintStatus" AS ENUM ('new', 'in_review', 'resolved', 'closed');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "platform_complaints" (
  "id"                       UUID            NOT NULL DEFAULT gen_random_uuid(),
  "reference_number"         VARCHAR(32)     NOT NULL,
  "name"                     VARCHAR(150)    NOT NULL,
  "phone"                    VARCHAR(30)     NOT NULL,
  "email"                    VARCHAR(150),
  "complaint_type"           VARCHAR(80)     NOT NULL,
  "order_or_invoice_number"  VARCHAR(80),
  "message"                  TEXT            NOT NULL,
  "status"                   "ComplaintStatus" NOT NULL DEFAULT 'new',
  "ip_address"               VARCHAR(45),
  "user_agent"               TEXT,
  "internal_notes"           TEXT,
  "created_at"               TIMESTAMPTZ     NOT NULL DEFAULT now(),
  "updated_at"               TIMESTAMPTZ     NOT NULL DEFAULT now(),
  CONSTRAINT "platform_complaints_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "platform_complaints_reference_number_key" UNIQUE ("reference_number")
);

CREATE INDEX IF NOT EXISTS "platform_complaints_status_idx"     ON "platform_complaints"("status");
CREATE INDEX IF NOT EXISTS "platform_complaints_created_at_idx" ON "platform_complaints"("created_at");
CREATE INDEX IF NOT EXISTS "platform_complaints_phone_idx"      ON "platform_complaints"("phone");
