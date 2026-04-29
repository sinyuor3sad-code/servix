CREATE TYPE "PosCheckoutAttemptStatus" AS ENUM ('in_progress', 'completed', 'failed');

ALTER TABLE "invoices"
  ADD COLUMN "pos_shift_id" UUID,
  ADD COLUMN "receipt_snapshot" JSONB,
  ADD COLUMN "receipt_snapshot_version" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "payments"
  ADD COLUMN "cash_received" DECIMAL(10, 2),
  ADD COLUMN "change_amount" DECIMAL(10, 2);

CREATE TABLE "pos_checkout_attempts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "idempotency_key" VARCHAR(100) NOT NULL,
  "request_hash" VARCHAR(64) NOT NULL,
  "status" "PosCheckoutAttemptStatus" NOT NULL DEFAULT 'in_progress',
  "invoice_id" UUID,
  "response_json" JSONB,
  "created_by" UUID NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "pos_checkout_attempts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pos_checkout_attempts_idempotency_key_key"
  ON "pos_checkout_attempts"("idempotency_key");

CREATE INDEX "pos_checkout_attempts_status_idx"
  ON "pos_checkout_attempts"("status");

CREATE INDEX "pos_checkout_attempts_invoice_id_idx"
  ON "pos_checkout_attempts"("invoice_id");

CREATE INDEX "invoices_pos_shift_id_idx"
  ON "invoices"("pos_shift_id");

ALTER TABLE "invoices"
  ADD CONSTRAINT "invoices_pos_shift_id_fkey"
  FOREIGN KEY ("pos_shift_id") REFERENCES "pos_shifts"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "pos_checkout_attempts"
  ADD CONSTRAINT "pos_checkout_attempts_invoice_id_fkey"
  FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
