#!/bin/bash
# Migration: Add POS atomic checkout tables and columns for all tenant DBs
# Safe to re-run: uses IF NOT EXISTS and DO $$ blocks

DATABASES=$(psql -U servix -h postgres -t -A -c "SELECT datname FROM pg_database WHERE datname LIKE 'servix_tenant_%'")

for DB in $DATABASES; do
  echo "=== Migrating: $DB ==="
  psql -U servix -h postgres -d "$DB" -c "
    -- 1. Create enum (skip if exists)
    DO \$\$ BEGIN
      CREATE TYPE \"PosCheckoutAttemptStatus\" AS ENUM ('in_progress', 'completed', 'failed');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END \$\$;

    -- 2. Add columns to invoices
    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS pos_shift_id UUID;
    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS receipt_snapshot JSONB;
    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS receipt_snapshot_version INTEGER NOT NULL DEFAULT 1;

    -- 3. Add columns to payments
    ALTER TABLE payments ADD COLUMN IF NOT EXISTS cash_received DECIMAL(10, 2);
    ALTER TABLE payments ADD COLUMN IF NOT EXISTS change_amount DECIMAL(10, 2);

    -- 4. Create pos_checkout_attempts table
    CREATE TABLE IF NOT EXISTS pos_checkout_attempts (
      id UUID NOT NULL DEFAULT gen_random_uuid(),
      idempotency_key VARCHAR(100) NOT NULL,
      request_hash VARCHAR(64) NOT NULL,
      status \"PosCheckoutAttemptStatus\" NOT NULL DEFAULT 'in_progress',
      invoice_id UUID,
      response_json JSONB,
      created_by UUID NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT pos_checkout_attempts_pkey PRIMARY KEY (id)
    );

    -- 5. Create indexes (skip if exist)
    CREATE UNIQUE INDEX IF NOT EXISTS pos_checkout_attempts_idempotency_key_key ON pos_checkout_attempts(idempotency_key);
    CREATE INDEX IF NOT EXISTS pos_checkout_attempts_status_idx ON pos_checkout_attempts(status);
    CREATE INDEX IF NOT EXISTS pos_checkout_attempts_invoice_id_idx ON pos_checkout_attempts(invoice_id);
    CREATE INDEX IF NOT EXISTS invoices_pos_shift_id_idx ON invoices(pos_shift_id);

    -- 6. Add foreign keys (skip if exist)
    DO \$\$ BEGIN
      ALTER TABLE invoices ADD CONSTRAINT invoices_pos_shift_id_fkey
        FOREIGN KEY (pos_shift_id) REFERENCES pos_shifts(id) ON DELETE SET NULL ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END \$\$;

    DO \$\$ BEGIN
      ALTER TABLE pos_checkout_attempts ADD CONSTRAINT pos_checkout_attempts_invoice_id_fkey
        FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END \$\$;
  "
  echo "=== Done: $DB ==="
done
