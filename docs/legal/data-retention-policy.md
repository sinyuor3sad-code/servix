# Data Retention Policy — SERVIX

**Effective Date:** April 2026

## Purpose
This policy defines how long SERVIX retains personal and business data, in compliance with the Saudi Personal Data Protection Law (PDPL) and ZATCA regulations.

## Retention Schedule

| Data Category | Retention Period | Justification | Disposal Method |
|--------------|-----------------|---------------|-----------------|
| User account data | Active + 30 days after deletion | PDPL right to erasure | Anonymization |
| Appointment records | Active subscription + 1 year | Business continuity | Soft delete → purge |
| Invoices & tax data | **7 years** | ZATCA legal requirement | Archived, read-only |
| Payment transactions | **7 years** | Financial regulations | Archived |
| Audit/access logs | **3 years** | Security & compliance | Automatic rotation |
| System logs | **90 days** | Troubleshooting | Automatic deletion |
| Backups | **90 days** | Disaster recovery | Encrypted deletion |
| Session tokens | **24 hours** (access) / **7 days** (refresh) | Security | Automatic expiry |
| Failed login records | **30 days** | Brute-force protection | Automatic cleanup |

## Deletion Process

### User-Requested Deletion
1. User submits deletion request via `DELETE /api/v1/data-rights/my-data`
2. 30-day cooling period (user can cancel)
3. After 30 days: personal data anonymized, non-essential records deleted
4. **Exception:** Tax/invoice data retained per ZATCA requirements

### Automatic Cleanup (Cron Jobs)
- Daily: Process pending account deletions
- Weekly: Purge expired sessions and tokens
- Monthly: Archive old audit logs
- Quarterly: Verify retention compliance

## Data Minimization
- Only essential data is collected
- Analytics use aggregated/anonymized data
- Payment card details are never stored (handled by Moyasar)
