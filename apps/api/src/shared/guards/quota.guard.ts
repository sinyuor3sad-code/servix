import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';

/**
 * QuotaGuard: Enforces plan-based resource limits.
 * Applied globally. Only checks POST requests (resource creation).
 * Quota limits are derived from the tenant's active plan.
 * Queries the actual resource count from the tenant database.
 */
@Injectable()
export class QuotaGuard implements CanActivate {
  private readonly logger = new Logger(QuotaGuard.name);

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Only check on creation (POST)
    if (request.method !== 'POST') return true;

    const tenantId = request.headers?.['x-tenant-id'] || request.user?.tenantId;
    if (!tenantId) return true; // No tenant context (admin routes)

    const resource = this.detectResource(context);
    if (!resource) return true; // Not a quota-managed resource

    // Get current tenant plan limits
    const tenant = request.tenant;
    if (!tenant?.subscription?.plan) return true; // No plan = unlimited

    const plan = tenant.subscription.plan;
    const limit = this.getLimit(plan, resource);
    if (limit === -1) return true; // Unlimited

    // Query actual usage from tenant database
    const db = request.tenantDb;
    if (!db) return true; // No database connection

    const usage = await this.getActualUsage(db, resource);

    if (usage >= limit) {
      this.logger.warn(
        `Quota exceeded: tenant=${tenantId}, resource=${resource}, usage=${usage}, limit=${limit}`,
      );
      throw new ForbiddenException({
        code: 'QUOTA_EXCEEDED',
        message: `تم تجاوز الحد الأقصى لـ ${resource}. الحد: ${limit}، الاستخدام: ${usage}. قم بترقية خطتك.`,
        resource,
        currentUsage: usage,
        limit,
      });
    }

    return true;
  }

  private detectResource(context: ExecutionContext): string | null {
    const controller = context.getClass().name.toLowerCase();
    if (controller.includes('employee')) return 'employees';
    if (controller.includes('client')) return 'clients';
    if (controller.includes('appointment')) return 'appointments';
    if (controller.includes('service')) return 'services';
    if (controller.includes('invoice')) return 'invoices';
    return null;
  }

  private async getActualUsage(db: any, resource: string): Promise<number> {
    try {
      switch (resource) {
        case 'employees':
          return db.employee.count({ where: { isActive: true } });
        case 'clients':
          return db.client.count({ where: { isActive: true, deletedAt: null } });
        case 'services':
          return db.service.count({ where: { isActive: true } });
        case 'appointments': {
          // Count this month's appointments only
          const startOfMonth = new Date();
          startOfMonth.setDate(1);
          startOfMonth.setHours(0, 0, 0, 0);
          return db.appointment.count({ where: { createdAt: { gte: startOfMonth } } });
        }
        case 'invoices': {
          const invoiceStart = new Date();
          invoiceStart.setDate(1);
          invoiceStart.setHours(0, 0, 0, 0);
          return db.invoice.count({ where: { createdAt: { gte: invoiceStart } } });
        }
        default:
          return 0;
      }
    } catch (err) {
      this.logger.error(`Failed to get usage for ${resource}: ${err}`);
      return 0; // fail-open on DB errors
    }
  }

  private getLimit(plan: any, resource: string): number {
    const planSlug = (plan.slug || plan.name || '').toLowerCase();

    const quotas: Record<string, Record<string, number>> = {
      basic: { employees: 5, clients: 100, appointments: 500, services: 20, invoices: 200 },
      pro: { employees: 15, clients: 500, appointments: 2000, services: 50, invoices: 1000 },
      premium: { employees: -1, clients: -1, appointments: -1, services: -1, invoices: -1 },
      enterprise: { employees: -1, clients: -1, appointments: -1, services: -1, invoices: -1 },
    };

    return quotas[planSlug]?.[resource] ?? -1;
  }
}
