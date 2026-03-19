import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../../shared/decorators';
import { PlatformPrismaClient } from '../../shared/database/platform.client';

@ApiTags('Health')
@Controller({ path: 'health', version: '1' })
export class HealthController {
  constructor(private readonly prisma: PlatformPrismaClient) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Health check' })
  async check() {
    const dbHealthy = await this.checkDatabase();
    const status = dbHealthy ? 'ok' : 'degraded';

    return {
      status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        database: dbHealthy ? 'connected' : 'disconnected',
      },
    };
  }

  @Public()
  @Get('ready')
  @ApiOperation({ summary: 'Readiness check' })
  async ready() {
    const dbHealthy = await this.checkDatabase();
    if (!dbHealthy) {
      return { status: 'not_ready' };
    }
    return { status: 'ready' };
  }

  private async checkDatabase(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}
