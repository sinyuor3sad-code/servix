-- Smart Menu + Invoice QR + Rating System schema changes
-- Applied to existing tenant databases

-- ═══════ SalonInfo: theme & display fields ═══════
ALTER TABLE "salon_info" ADD COLUMN IF NOT EXISTS "logo_url" VARCHAR(500);
ALTER TABLE "salon_info" ADD COLUMN IF NOT EXISTS "cover_image_url" VARCHAR(500);
ALTER TABLE "salon_info" ADD COLUMN IF NOT EXISTS "brand_color_preset" VARCHAR(30) NOT NULL DEFAULT 'purple';
ALTER TABLE "salon_info" ADD COLUMN IF NOT EXISTS "theme_layout" VARCHAR(30) NOT NULL DEFAULT 'classic';
ALTER TABLE "salon_info" ADD COLUMN IF NOT EXISTS "welcome_message" VARCHAR(300);
ALTER TABLE "salon_info" ADD COLUMN IF NOT EXISTS "google_maps_url" VARCHAR(500);
ALTER TABLE "salon_info" ADD COLUMN IF NOT EXISTS "google_place_id" VARCHAR(100);

-- ═══════ Invoice: public token + self-order link ═══════
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "public_token" VARCHAR(64);
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "public_token_status" VARCHAR(20) NOT NULL DEFAULT 'active';
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "public_token_created_at" TIMESTAMPTZ;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "public_token_revoked_at" TIMESTAMPTZ;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "self_order_id" UUID;

CREATE UNIQUE INDEX IF NOT EXISTS "invoices_public_token_key" ON "invoices"("public_token");
CREATE UNIQUE INDEX IF NOT EXISTS "invoices_self_order_id_key" ON "invoices"("self_order_id");

-- ═══════ Enum: SelfOrderStatus ═══════
DO $$ BEGIN
  CREATE TYPE "SelfOrderStatus" AS ENUM ('pending', 'claimed', 'paid', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ═══════ Table: self_orders ═══════
CREATE TABLE IF NOT EXISTS "self_orders" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "order_code" VARCHAR(10) NOT NULL,
  "status" "SelfOrderStatus" NOT NULL DEFAULT 'pending',
  "services" JSONB NOT NULL,
  "total_estimate" DECIMAL(10,2) NOT NULL,
  "month_letter" VARCHAR(1) NOT NULL,
  "expires_at" TIMESTAMPTZ NOT NULL,
  "claimed_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "self_orders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "self_orders_order_code_month_letter_key" ON "self_orders"("order_code", "month_letter");
CREATE INDEX IF NOT EXISTS "self_orders_status_expires_at_idx" ON "self_orders"("status", "expires_at");
CREATE INDEX IF NOT EXISTS "self_orders_order_code_idx" ON "self_orders"("order_code");

-- FK: invoices.self_order_id → self_orders.id
DO $$ BEGIN
  ALTER TABLE "invoices" ADD CONSTRAINT "invoices_self_order_id_fkey"
    FOREIGN KEY ("self_order_id") REFERENCES "self_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ═══════ Table: invoice_feedbacks ═══════
CREATE TABLE IF NOT EXISTS "invoice_feedbacks" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "invoice_id" UUID NOT NULL,
  "rating" SMALLINT NOT NULL,
  "comment" TEXT,
  "source" VARCHAR(20) NOT NULL DEFAULT 'qr',
  "google_prompt_shown" BOOLEAN NOT NULL DEFAULT false,
  "google_clicked" BOOLEAN NOT NULL DEFAULT false,
  "follow_up_status" VARCHAR(30) NOT NULL DEFAULT 'new',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "invoice_feedbacks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "invoice_feedbacks_invoice_id_key" ON "invoice_feedbacks"("invoice_id");

-- FK: invoice_feedbacks.invoice_id → invoices.id (CASCADE)
DO $$ BEGIN
  ALTER TABLE "invoice_feedbacks" ADD CONSTRAINT "invoice_feedbacks_invoice_id_fkey"
    FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
