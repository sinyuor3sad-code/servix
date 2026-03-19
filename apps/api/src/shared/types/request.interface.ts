import { Request } from 'express';
import { JwtPayload } from './jwt-payload.interface';
import type { Tenant } from '../database';
import type { TenantPrismaClient } from './tenant-db.type';
import type { SubscriptionStatus } from '../../core/subscriptions/subscription-status.service';

export interface AuthenticatedRequest extends Request {
  user: JwtPayload;
  tenant?: Tenant;
  tenantDb?: TenantPrismaClient;
  features?: string[];
  subscriptionStatus?: SubscriptionStatus;
}
