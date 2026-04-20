-- WhatsApp Opt-Outs + Loyalty Visits schema changes
-- Applied to tenant databases via `prisma migrate deploy`

-- ═══════ Extend LoyaltyTransactionType enum (visit-based entries) ═══════
DO $$ BEGIN
  ALTER TYPE "LoyaltyTransactionType" ADD VALUE IF NOT EXISTS 'visit_earned';
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "LoyaltyTransactionType" ADD VALUE IF NOT EXISTS 'visit_redeemed';
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "LoyaltyTransactionType" ADD VALUE IF NOT EXISTS 'visit_adjusted';
EXCEPTION WHEN others THEN NULL;
END $$;

-- ═══════ LoyaltyPoints: visit-tracking columns ═══════
ALTER TABLE "loyalty_points" ADD COLUMN IF NOT EXISTS "visit_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "loyalty_points" ADD COLUMN IF NOT EXISTS "lifetime_visits" INTEGER NOT NULL DEFAULT 0;

-- ═══════ Table: whatsapp_opt_outs ═══════
CREATE TABLE IF NOT EXISTS "whatsapp_opt_outs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "phone" VARCHAR(20) NOT NULL,
  "reason" VARCHAR(200),
  "opted_out_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "whatsapp_opt_outs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "whatsapp_opt_outs_phone_key" ON "whatsapp_opt_outs"("phone");
CREATE INDEX IF NOT EXISTS "whatsapp_opt_outs_phone_idx" ON "whatsapp_opt_outs"("phone");
