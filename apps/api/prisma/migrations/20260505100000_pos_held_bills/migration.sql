-- Server-backed POS Held Bills (Hold/Recall across devices).
-- Tied to PosShift; closing or deleting a shift cascades to its held bills.

CREATE TABLE "pos_held_bills" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "shift_id" UUID NOT NULL,
  "terminal_id" VARCHAR(50),
  "label" VARCHAR(120) NOT NULL,
  "cart" JSONB NOT NULL,
  "client_id" UUID,
  "walk_in_name" VARCHAR(100),
  "walk_in_phone" VARCHAR(15),
  "global_discount" VARCHAR(20) NOT NULL DEFAULT '',
  "global_discount_type" VARCHAR(15) NOT NULL DEFAULT 'fixed',
  "total" DECIMAL(10, 2) NOT NULL DEFAULT 0,
  "created_by" UUID NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "pos_held_bills_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "pos_held_bills_shift_id_idx" ON "pos_held_bills"("shift_id");
CREATE INDEX "pos_held_bills_created_at_idx" ON "pos_held_bills"("created_at");

ALTER TABLE "pos_held_bills"
  ADD CONSTRAINT "pos_held_bills_shift_id_fkey"
  FOREIGN KEY ("shift_id") REFERENCES "pos_shifts"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pos_held_bills"
  ADD CONSTRAINT "pos_held_bills_client_id_fkey"
  FOREIGN KEY ("client_id") REFERENCES "clients"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
