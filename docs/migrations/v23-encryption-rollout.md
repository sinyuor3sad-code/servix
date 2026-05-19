# V-23 / A1-002 — Encryption-at-rest rollout

**Severity:** HIGH (P1).
**Owner across phases:** Engineer 2 (schema) + Engineer 4 (backfill / app integration).
**Created:** 2026-05-19.
**Audit source:** `docs/principal-audit/synthesis-2026-05-14.md`.

## What this protects

Three plaintext secrets currently sit in the database with no encryption at rest:

| Column | DB | Sensitivity |
|---|---|---|
| `users.two_factor_secret` | platform | TOTP shared secret — anyone with read access generates valid 2FA codes |
| `whatsapp_instances.instance_token` | platform | Evolution API token — full WhatsApp control for the tenant |
| `zatca_certificates.private_key` | tenant | RSA private key — ZATCA signing identity |

A DB breach (read-only SQL injection, stolen backup, mis-permissioned replica) currently exposes all three in clear text. AES-256-GCM column-level encryption keyed off `ENCRYPTION_KEY` (already present in `env.validation.ts`) prevents this.

## Phased plan

The migration cannot land in one step without rewriting application code under the same change. We stage:

### Phase 1 — Add encrypted columns alongside (this card, Engineer 2)

- `BYTEA NULL` column next to each plaintext column. Naming: `<original>_encrypted`.
- No application code change. No data movement.
- Both columns coexist during phases 1 → 2.

Files in this phase:
```
apps/api/prisma/platform-migrations/20260519_v23_encryption_columns_phase1.sql
apps/api/prisma/migrations/20260519_v23_encryption_columns_phase1/migration.sql
apps/api/prisma/platform.prisma    (+ 2 Bytes? fields)
apps/api/prisma/tenant.prisma      (+ 1 Bytes? field)
```

Apply via `docs/migrations/v23-apply.md`.

### Phase 2 — Backfill + dual-read/single-write (Engineer 4, K1/K2 milestone)

Once Phase 1 is on every prod DB, Engineer 4 implements:

1. **Single-write path:** every code path that sets one of these secrets writes to `<col>_encrypted` only. The plaintext column is no longer written.
2. **Dual-read path with fallback** in `apps/api/src/shared/encryption/encryption.service.ts` (the consumer):
   ```ts
   const ciphertext = row.twoFactorSecretEncrypted;
   if (ciphertext) return decrypt(ciphertext);
   if (row.twoFactorSecret) return row.twoFactorSecret;  // legacy plaintext
   return null;
   ```
3. **Backfill batch script** in `tooling/scripts/`:
   - reads rows where `<col>_encrypted IS NULL AND <plaintext> IS NOT NULL`
   - encrypts plaintext with AES-256-GCM using `ENCRYPTION_KEY`
   - writes ciphertext to `<col>_encrypted`
   - commits in batches (e.g. 500/transaction)
   - idempotent: re-running picks up only un-encrypted rows
4. **Verification:** every selected row returns `<col>_encrypted IS NOT NULL` after the run.

**Blast radius on prod (2026-05-19 snapshot):**

| DB | Table | Rows to backfill |
|---|---|---|
| `servix_platform` | `users` (`two_factor_secret IS NOT NULL`) | **0** |
| `servix_platform` | `whatsapp_instances` (`instance_token IS NOT NULL`) | **2** |
| `servix_tenant_d0f48d47` | `zatca_certificates` (`private_key IS NOT NULL`) | **0** |
| `servix_tenant_test_ai_reception` | same | **0** |
| **Total** | | **2** |

ZATCA has not been provisioned for either active tenant yet, and 2FA is not enabled for any user. Only the two WhatsApp instance tokens need real backfill — both write paths are well isolated to `WhatsAppEvolutionService`.

### Phase 3 — Drop plaintext columns (Engineer 2, +30 days after Phase 2)

After Phase 2 has been running cleanly on staging for 30 days (no fallback hits in logs, no decryption errors, no support tickets):

1. Verify zero rows where `<plaintext> IS NOT NULL AND <encrypted> IS NULL` (every plaintext has an encrypted counterpart).
2. **NOT NULL columns first need a transition**: `whatsapp_instances.instance_token` and `zatca_certificates.private_key` are currently NOT NULL. Phase 3 migration must (a) make plaintext column nullable, (b) make encrypted column NOT NULL, (c) drop plaintext column. This will be a separate Phase 3 card.
3. Migration file: `20260YYY_v23_phase3_drop_plaintext` — schema edit removing the plaintext fields, raw SQL `ALTER TABLE … DROP COLUMN …`.
4. Cleanup encryption.service dual-read fallback at the same time.

## Out of scope (deliberate)

- **`zatca_certificates.csr_content`** — the Certificate Signing Request is sent to ZATCA over TLS and stored on their side. It contains the public key and certificate metadata; no secret material. Encrypting it at rest adds no defense against a DB breach because the same data is shared externally by design.
- **`zatca_certificates.public_key`** — public by definition. Published with every signed invoice and embedded in the X.509 certificate chain. Encrypting it would be operational overhead with zero security gain.
- **`zatca_certificates.certificate_content` / `csid`** — also public/CSID metadata returned by ZATCA, not secret.

## Coordination across engineers

- **Engineer 2 (this card):** schema + DDL only. No code changes. Hands Phase 2 off to Engineer 4 via this doc.
- **Engineer 4 (Phase 2):** `apps/api/src/shared/encryption/encryption.service.ts` integration + `tooling/scripts/backfill-encryption.ts` + write-path updates in `whatsapp-evolution.service.ts`, the auth service (2FA setup), and the ZATCA onboarding service. Will use the `AesEncryption` helper that already exists; do not add new crypto primitives.
- **Engineer 2 (Phase 3):** plaintext-drop migration after the 30-day soak. Engineer 4 confirms the dual-read fallback has zero hits before this lands.

## Why three phases not one

A single-phase atomic rewrite (add column + backfill + drop in one migration) would require taking writes offline for the duration. Even with two WhatsApp tokens to backfill, the *application* paths that read those tokens are live; switching them over to `_encrypted` while the column does not yet exist is the failure mode we are avoiding. The staged approach keeps every intermediate state runnable on production.
