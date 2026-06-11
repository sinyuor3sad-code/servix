import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PlatformPrismaClient } from '../../../shared/database/platform.client';
import { TenantClientFactory } from '../../../shared/database/tenant-client.factory';
import { TenantPrismaClient } from '../../../shared/types';
import { PosShiftsService } from './pos-shifts.service';

/**
 * POS Shifts Expirer — auto-closes shifts that have been left open beyond the
 * configured threshold. Cashiers commonly forget to close at end of day; this
 * keeps Z-Reports and shift accounting honest by computing expected cash from
 * actual sales/refunds/expenses and closing with closingBalance = expectedCash
 * (so the shift records "no manual cash count was performed").
 *
 * Runs hourly across every active/trial tenant.
 */
@Injectable()
export class PosShiftsExpirer {
  private readonly logger = new Logger(PosShiftsExpirer.name);
  private static readonly STALE_AFTER_HOURS = 18;

  constructor(
    private readonly platformDb: PlatformPrismaClient,
    private readonly tenantFactory: TenantClientFactory,
    private readonly posShiftsService: PosShiftsService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleStaleShifts(): Promise<void> {
    try {
      const tenants = await this.platformDb.tenant.findMany({
        where: { status: { in: ['active', 'trial'] } },
        select: { id: true, databaseName: true, slug: true },
      });

      for (const tenant of tenants) {
        try {
          await this.expireForTenant(tenant.databaseName, tenant.slug);
        } catch (err) {
          this.logger.error(
            `Stale-shift expirer error for ${tenant.slug}: ${(err as Error).message}`,
          );
        }
      }
    } catch (err) {
      this.logger.error(`Stale-shift cron failed: ${(err as Error).message}`);
    }
  }

  private async expireForTenant(databaseName: string, slug: string): Promise<void> {
    const tenantDb = this.tenantFactory.getTenantClient(databaseName) as TenantPrismaClient;

    const cutoff = new Date(Date.now() - PosShiftsExpirer.STALE_AFTER_HOURS * 60 * 60 * 1000);
    const stale = await tenantDb.posShift.findMany({
      where: { status: 'open', openedAt: { lt: cutoff } },
      select: { id: true, openedBy: true, openedAt: true },
    });

    if (stale.length === 0) return;

    for (const shift of stale) {
      try {
        await this.posShiftsService.close(
          tenantDb,
          {
            closingBalance: 0,
            notes: `Auto-closed by system after ${PosShiftsExpirer.STALE_AFTER_HOURS}h timeout (no manual cash count)`,
          },
          shift.openedBy,
          { auto: true, shiftId: shift.id },
        );
        this.logger.warn(
          `🔒 Auto-closed stale POS shift ${shift.id} in ${slug} (opened ${shift.openedAt.toISOString()})`,
        );
      } catch (err) {
        this.logger.error(
          `Failed to auto-close shift ${shift.id} in ${slug}: ${(err as Error).message}`,
        );
      }
    }
  }
}
