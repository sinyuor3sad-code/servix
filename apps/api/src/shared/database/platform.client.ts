import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '../../../generated/platform';

@Injectable()
export class PlatformPrismaClient extends PrismaClient implements OnModuleDestroy {
  constructor() {
    super({
      datasources: {
        db: { url: process.env.PLATFORM_DATABASE_URL },
      },
      log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['error'],
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
