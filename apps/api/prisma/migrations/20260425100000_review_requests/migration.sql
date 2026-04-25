CREATE TABLE IF NOT EXISTS "review_requests" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "appointment_id" UUID,
  "invoice_id" UUID,
  "customer_phone" VARCHAR(20) NOT NULL,
  "customer_name" VARCHAR(100),
  "rating" SMALLINT,
  "feedback_text" TEXT,
  "source" VARCHAR(20) NOT NULL DEFAULT 'invoice',
  "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
  "due_at" TIMESTAMPTZ NOT NULL,
  "expires_at" TIMESTAMPTZ NOT NULL,
  "request_sent_at" TIMESTAMPTZ,
  "responded_at" TIMESTAMPTZ,
  "google_link_sent" BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "review_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "review_requests_rating_check" CHECK ("rating" IS NULL OR ("rating" >= 1 AND "rating" <= 5))
);

CREATE UNIQUE INDEX IF NOT EXISTS "review_requests_appointment_id_key"
  ON "review_requests"("appointment_id")
  WHERE "appointment_id" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "review_requests_invoice_id_key"
  ON "review_requests"("invoice_id")
  WHERE "invoice_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "review_requests_status_due_at_idx"
  ON "review_requests"("status", "due_at");

CREATE INDEX IF NOT EXISTS "review_requests_customer_phone_status_created_idx"
  ON "review_requests"("customer_phone", "status", "created_at");

DO $$ BEGIN
  ALTER TABLE "review_requests"
    ADD CONSTRAINT "review_requests_appointment_id_fkey"
    FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "review_requests"
    ADD CONSTRAINT "review_requests_invoice_id_fkey"
    FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
