-- Add public key field to zatca_certificates table
ALTER TABLE zatca_certificates ADD COLUMN IF NOT EXISTS public_key TEXT;
