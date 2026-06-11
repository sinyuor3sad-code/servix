#!/bin/bash
# Migration: Add NFC fields to invoices table for all tenant DBs

DATABASES=$(psql -U servix -h postgres -t -A -c "SELECT datname FROM pg_database WHERE datname LIKE 'servix_tenant_%'")

for DB in $DATABASES; do
  echo "=== Migrating: $DB ==="
  psql -U servix -h postgres -d "$DB" -c "
    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS terminal_id VARCHAR(50);
    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS nfc_claimed_at TIMESTAMPTZ;
    CREATE INDEX IF NOT EXISTS invoices_terminal_id_nfc_claimed_at_idx ON invoices(terminal_id, nfc_claimed_at);
  "
  echo "=== Done: $DB ==="
done
