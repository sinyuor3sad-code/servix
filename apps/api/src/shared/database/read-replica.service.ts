import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '../../../generated/platform';

/**
 * ReadReplicaService provides a read-only Prisma client pointing to
 * DATABASE_READ_URL. Falls back to the primary DATABASE_URL if
 * the read replica URL is not configured.
 *
 * Use for:
 * - Admin dashboard statistics
 * - Report generation
 * - Heavy read queries (client lists, appointment history)
 *
 * Do NOT use for:
 * - Writes (bookings, invoices, auth)
 * - Reads requiring real-time consistency (conflict detection)
 */
@Injectable()
export class ReadReplicaService implements OnModuleDestroy {
  private readonly logger = new Logger(ReadReplicaService.name);
  private readonly readClient: PrismaClient;
  private readonly isReplica: boolean;

  constructor(private readonly configService: ConfigService) {
    const readUrl = this.configService.get<string>('DATABASE_READ_URL', '');
    const primaryUrl = this.configService.get<string>('PLATFORM_DATABASE_URL', '');

    const url = readUrl || primaryUrl;
    this.isReplica = !!readUrl;

    if (this.isReplica) {
      this.logger.log('Read replica configured — routing heavy reads to replica');
    } else {
      this.logger.log('No read replica configured — using primary for all reads');
    }

    this.readClient = new PrismaClient({
      datasources: {
        db: { url },
      },
      log: [{ emit: 'event', level: 'warn' }],
    });
  }

  /**
   * Get the read-only Prisma client.
   * Routes to replica if configured, otherwise to primary.
   */
  get reader(): PrismaClient {
    return this.readClient;
  }

  /**
   * Whether this service is connected to an actual replica.
   */
  get usingReplica(): boolean {
    return this.isReplica;
  }

  async onModuleDestroy() {
    await this.readClient.$disconnect();
  }
}
