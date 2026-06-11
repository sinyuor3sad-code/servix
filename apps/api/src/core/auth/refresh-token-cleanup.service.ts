import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PlatformPrismaClient } from '../../shared/database/platform.client';

/**
 * V-13c-gc — daily cleanup of long-dead refresh_tokens rows.
 *
 * refresh_tokens is append-only at runtime: V-13c rotation / reuse-detection only
 * FLIP revoked_at, never DELETE. At ~1k DAU × ~7 rotations/day the table grows
 * ~50k rows/week. Postgres copes for years, but pruning keeps the hot indexes
 * (tokenHash, familyId) lean. This removes rows that have been dead — revoked, OR
 * naturally expired and never reused — for longer than the retention window, which
 * is well past any forensic value (reuse-detection only matters within a token's
 * own lifetime; a 90-day-revoked row can never be presented again).
 *
 * Relies on the app-wide ScheduleModule.forRoot() (the @Cron is discovered without
 * AuthModule importing ScheduleModule).
 */
@Injectable()
export class RefreshTokenCleanupService {
  private readonly logger = new Logger(RefreshTokenCleanupService.name);
  private static readonly RETENTION_DAYS = 90;

  constructor(private readonly prisma: PlatformPrismaClient) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgeDeadRefreshTokens(): Promise<void> {
    const cutoff = new Date(
      Date.now() -
        RefreshTokenCleanupService.RETENTION_DAYS * 24 * 60 * 60 * 1000,
    );

    try {
      const { count } = await this.prisma.refreshToken.deleteMany({
        where: {
          OR: [
            // Revoked (rotated / reuse_detected / logout / expired-and-marked)
            // more than RETENTION_DAYS ago.
            { revokedAt: { lt: cutoff } },
            // Never revoked but naturally expired long ago (e.g. a family the
            // user simply abandoned — the row was never presented again).
            { AND: [{ revokedAt: null }, { expiresAt: { lt: cutoff } }] },
          ],
        },
      });

      if (count > 0) {
        this.logger.log(
          `[refresh-token-gc] purged ${count} dead refresh_tokens older than ${RefreshTokenCleanupService.RETENTION_DAYS}d`,
        );
      }
    } catch (err) {
      this.logger.error(
        `[refresh-token-gc] purge failed: ${(err as Error).message}`,
      );
    }
  }
}
