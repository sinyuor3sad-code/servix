import { SetMetadata } from '@nestjs/common';

/**
 * V-37c — explicit quota-resource metadata. Marks a creation route as counting
 * against a plan-quota resource, enforced by the global QuotaGuard (V-37-wire).
 *
 * Replaces the old controller-NAME pattern matching in QuotaGuard, which
 * false-positived on any controller whose class name contained a resource
 * substring (e.g. ClientDnaController POSTs would have been gated against the
 * 'clients' quota). Routes without this decorator are never quota-checked.
 */
export const QUOTA_RESOURCE_KEY = 'quotaResource';

export type QuotaResourceName =
  | 'employees'
  | 'clients'
  | 'appointments'
  | 'services'
  | 'invoices';

export const QuotaResource = (
  resource: QuotaResourceName,
): ReturnType<typeof SetMetadata> => SetMetadata(QUOTA_RESOURCE_KEY, resource);
