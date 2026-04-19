import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PlatformPrismaClient } from '../../shared/database/platform.client';
import { TenantClientFactory } from '../../shared/database/tenant-client.factory';
import { EventsGateway } from '../../shared/events/events.gateway';
import { PublicService } from './public.service';

@Injectable()
export class OrderExpiryService {
  private readonly logger = new Logger(OrderExpiryService.name);
  private running = false;

  constructor(
    private readonly platformPrisma: PlatformPrismaClient,
    private readonly tenantClientFactory: TenantClientFactory,
    private readonly eventsGateway: EventsGateway,
    private readonly publicService: PublicService,
  ) {}

  @Interval(120_000) // Every 2 minutes (30min expiry doesn't need sub-minute precision)
  async handleExpiry() {
    // Prevent overlapping runs
    if (this.running) return;
    this.running = true;

    try {
      // Get all active tenants. Skip the platform tenant itself — its DB is
      // the platform schema (no selfOrder table). The seed creates it with
      // slug 'servix-platform' / databaseName 'servix_platform'.
      const platformDb = process.env.PLATFORM_DATABASE_NAME || 'servix_platform';
      const tenants = await this.platformPrisma.tenant.findMany({
        where: {
          status: 'active',
          slug: { notIn: ['servix-platform', 'platform-admin'] },
          databaseName: { not: platformDb },
        },
        select: { id: true, databaseName: true, slug: true },
      });

      let totalExpired = 0;
      let tenantsProcessed = 0;

      for (const tenant of tenants) {
        try {
          const db = this.tenantClientFactory.getTenantClient(
            tenant.databaseName,
          );

          // Skip tenants with no expired pending orders (avoids unnecessary UPDATE queries)
          const pendingCount = await db.selfOrder.count({
            where: { status: 'pending', expiresAt: { lt: new Date() } },
          });
          if (pendingCount === 0) continue;

          tenantsProcessed++;
          const expiredCodes = await this.publicService.expireOrders(db);

          if (expiredCodes.length > 0) {
            totalExpired += expiredCodes.length;

            // Notify each expired order's room via WebSocket
            for (const code of expiredCodes) {
              this.eventsGateway.emitToOrder(
                tenant.slug,
                code,
                'order:status',
                { status: 'expired' },
              );
            }

            // Also notify the POS dashboard
            this.eventsGateway.emitToTenant(
              tenant.id,
              'orders:expired',
              { codes: expiredCodes, count: expiredCodes.length },
            );
          }
        } catch (err) {
          // Don't let one tenant failure kill the entire cron
          this.logger.error(
            `[ExpiryJob] Error for tenant ${tenant.slug}: ${(err as Error).message}`,
          );
        }
      }

      if (totalExpired > 0) {
        this.logger.log(
          `[ExpiryJob] Expired ${totalExpired} orders across ${tenantsProcessed}/${tenants.length} tenants`,
        );
      }
    } catch (err) {
      this.logger.error(
        `[ExpiryJob] Critical error: ${(err as Error).message}`,
      );
    } finally {
      this.running = false;
    }
  }
}
