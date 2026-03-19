import type { Tenant } from '../database';
import type { TenantPrismaClient } from './tenant-db.type';

export interface TenantContext {
  tenant: Tenant;
  tenantDb: TenantPrismaClient;
  features: string[];
}
