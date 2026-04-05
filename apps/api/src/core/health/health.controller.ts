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
  @ApiOperation({ summary: 'Full health check' })
  async check() {
    const start = Date.now();
    const dbHealthy = await this.checkDatabase();

    return {
      status: dbHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      checks: {
        database: dbHealthy ? 'ok' : 'error',
        responseTime: `${Date.now() - start}ms`,
      },
    };
  }

  @Public()
  @Get('ready')
  @ApiOperation({ summary: 'Readiness check — is database connected' })
  async ready() {
    const dbHealthy = await this.checkDatabase();
    if (!dbHealthy) {
      return { status: 'not_ready' };
    }
    return { status: 'ready' };
  }

  @Public()
  @Get('live')
  @ApiOperation({ summary: 'Liveness check — is the process alive (for Docker/K8s)' })
  live() {
    return { status: 'alive' };
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
