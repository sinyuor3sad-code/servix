import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../../shared/decorators';
import { PlatformPrismaClient } from '../../shared/database/platform.client';
import * as os from 'os';
import * as fs from 'fs';

@ApiTags('Health')
@Controller({ path: 'health', version: '1' })
export class HealthController {
  private readonly startedAt = Date.now();

  constructor(private readonly prisma: PlatformPrismaClient) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Full health check with system resources' })
  async check() {
    const start = Date.now();
    const dbHealthy = await this.checkDatabase();

    // ── CPU usage (average across all cores) ──
    const cpus = os.cpus();
    let totalIdle = 0, totalTick = 0;
    for (const cpu of cpus) {
      for (const type of Object.keys(cpu.times) as (keyof typeof cpu.times)[]) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    }
    const cpuPercent = Math.round(((totalTick - totalIdle) / totalTick) * 100);

    // ── Memory usage ──
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memPercent = Math.round((usedMem / totalMem) * 100);

    // ── Disk usage (root partition) ──
    let diskPercent = 0;
    let diskTotal = 0;
    let diskUsed = 0;
    try {
      const stat = fs.statfsSync('/');
      diskTotal = stat.blocks * stat.bsize;
      const diskFree = stat.bfree * stat.bsize;
      diskUsed = diskTotal - diskFree;
      diskPercent = Math.round((diskUsed / diskTotal) * 100);
    } catch {
      // statfsSync not available on Windows — use 0
    }

    // ── Uptime ──
    const uptimeMs = Date.now() - this.startedAt;
    const uptimeDays = Math.floor(uptimeMs / 86400000);
    const uptimeHours = Math.floor((uptimeMs % 86400000) / 3600000);
    const uptimeMinutes = Math.floor((uptimeMs % 3600000) / 60000);

    return {
      status: dbHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      checks: {
        database: dbHealthy ? 'ok' : 'error',
        responseTime: `${Date.now() - start}ms`,
      },
      resources: {
        cpu: cpuPercent,
        memory: memPercent,
        disk: diskPercent,
        memoryTotal: this.formatBytes(totalMem),
        memoryUsed: this.formatBytes(usedMem),
        diskTotal: this.formatBytes(diskTotal),
        diskUsed: this.formatBytes(diskUsed),
      },
      uptime: {
        ms: uptimeMs,
        formatted: `${uptimeDays} يوم ${uptimeHours} ساعة ${uptimeMinutes} دقيقة`,
        days: uptimeDays,
        hours: uptimeHours,
        minutes: uptimeMinutes,
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

  // ── Public endpoint for plans (no auth needed, for landing page) ──
  @Public()
  @Get('plans')
  @ApiOperation({ summary: 'Public plans list for landing page' })
  async getPublicPlans() {
    const plans = await this.prisma.plan.findMany({
      where: { isActive: true },
      include: {
        planFeatures: {
          include: { feature: true },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    return plans.map((p: any) => ({
      id: p.id,
      name: p.name,
      nameAr: p.nameAr,
      descriptionAr: p.descriptionAr,
      priceMonthly: Number(p.priceMonthly),
      priceYearly: Number(p.priceYearly),
      maxEmployees: p.maxEmployees,
      maxClients: p.maxClients,
      features: (p.planFeatures || [])
        .filter((pf: any) => pf.enabled !== false)
        .map((pf: any) => ({
          nameAr: pf.feature?.nameAr ?? pf.featureId,
          code: pf.feature?.code ?? '',
        })),
    }));
  }

  private async checkDatabase(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }
}
