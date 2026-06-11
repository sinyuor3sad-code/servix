import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { Counter, Gauge, register as defaultRegistry } from 'prom-client';
import { PlatformPrismaClient } from '../../shared/database/platform.client';
import {
  AUDIT_OUTBOX_BATCH_SIZE,
  AUDIT_OUTBOX_DRAIN_INTERVAL_MS,
  AUDIT_OUTBOX_DRAIN_INTERVAL_NAME,
  AUDIT_OUTBOX_LAST_ERROR_MAXLEN,
  AUDIT_OUTBOX_MAX_ATTEMPTS,
  AUDIT_OUTBOX_STUCK_PROCESSING_MS,
  METRIC_AUDIT_OUTBOX_DELIVERED_TOTAL,
  METRIC_AUDIT_OUTBOX_FAILED_TOTAL,
  METRIC_AUDIT_OUTBOX_LAG_SECONDS,
} from './audit-outbox.constants';

/** Shape returned by the FOR UPDATE SKIP LOCKED claim (snake_case columns). */
interface ClaimedRow {
  id: string;
  tenant_id: string | null;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  old_values: unknown;
  new_values: unknown;
  ip_address: string | null;
  user_agent: string | null;
  attempts: number;
  created_at: Date;
}

/**
 * V-35b — Relay that drains platform_audit_outbox into platform_audit_logs.
 *
 * Design (approved 2026-05-30):
 *  - Claim a batch with UPDATE … WHERE id IN (SELECT … FOR UPDATE SKIP LOCKED)
 *    so the multi-instance prod fleet (api-1/api-2) never double-processes a row.
 *  - Terminal insert uses ON CONFLICT (id) DO NOTHING (audit_logs.id = outbox.id)
 *    ⇒ a retry after a partial crash is exactly-once in effect.
 *  - Poison rows (e.g. a dangling user_id the FK-checked insert rejects) retry up
 *    to MAX_ATTEMPTS, then park as terminal `failed` (dead-letter) so they can't
 *    inflate the lag gauge / fire a false alert forever.
 *  - A sweeper returns rows orphaned in `processing` (crashed worker) to `pending`.
 *  - Metrics: lag gauge (oldest pending age) + delivered/failed counters. E1 wires
 *    the Prometheus alert on lag > 60s (V-35d companion card).
 *
 * The poll runs in-process via @Interval (matching the repo's *.expirer pattern);
 * the outbox table itself is the durable queue, so no extra BullMQ queue is needed.
 */
@Injectable()
export class AuditOutboxProcessor implements OnModuleInit {
  private readonly logger = new Logger(AuditOutboxProcessor.name);
  private draining = false;

  private readonly lagGauge: Gauge<string>;
  private readonly deliveredCounter: Counter<string>;
  private readonly failedCounter: Counter<string>;

  constructor(private readonly prisma: PlatformPrismaClient) {
    // Register on prom-client's DEFAULT registry — the same one MetricsService
    // and the /metrics controller already expose. This surfaces the audit-outbox
    // gauges without coupling to (or editing) the shared MetricsService, keeping
    // V-35b entirely within the core/audit scope.
    const registry = defaultRegistry;

    // getOrCreate guards against "already registered" if the module is
    // instantiated more than once (e.g. across test modules sharing a registry).
    this.lagGauge =
      (registry.getSingleMetric(METRIC_AUDIT_OUTBOX_LAG_SECONDS) as Gauge<string>) ??
      new Gauge({
        name: METRIC_AUDIT_OUTBOX_LAG_SECONDS,
        help: 'Age in seconds of the oldest pending audit-outbox row (0 when none). Alert > 60s.',
        registers: [registry],
        collect: () => this.refreshLagGauge(),
      });

    this.deliveredCounter =
      (registry.getSingleMetric(METRIC_AUDIT_OUTBOX_DELIVERED_TOTAL) as Counter<string>) ??
      new Counter({
        name: METRIC_AUDIT_OUTBOX_DELIVERED_TOTAL,
        help: 'Total audit-outbox rows delivered to platform_audit_logs.',
        registers: [registry],
      });

    this.failedCounter =
      (registry.getSingleMetric(METRIC_AUDIT_OUTBOX_FAILED_TOTAL) as Counter<string>) ??
      new Counter({
        name: METRIC_AUDIT_OUTBOX_FAILED_TOTAL,
        help: 'Total audit-outbox rows parked as terminal failed (poison dead-letter).',
        registers: [registry],
      });
  }

  onModuleInit(): void {
    this.logger.log(
      `Audit outbox relay armed: drain every ${AUDIT_OUTBOX_DRAIN_INTERVAL_MS}ms, ` +
        `batch=${AUDIT_OUTBOX_BATCH_SIZE}, maxAttempts=${AUDIT_OUTBOX_MAX_ATTEMPTS}`,
    );
  }

  /** Prometheus collect hook: set the lag gauge from the oldest pending row. */
  private async refreshLagGauge(): Promise<void> {
    try {
      const rows = await this.prisma.$queryRaw<{ lag: number }[]>`
        SELECT COALESCE(EXTRACT(EPOCH FROM (now() - MIN("created_at"))), 0)::float8 AS lag
        FROM "platform_audit_outbox"
        WHERE "status" = 'pending'
      `;
      this.lagGauge.set(Number(rows[0]?.lag ?? 0));
    } catch (e) {
      // Never let a metrics scrape fail the whole /metrics endpoint.
      this.logger.warn(`[audit-outbox] lag gauge refresh failed: ${(e as Error).message}`);
    }
  }

  @Interval(AUDIT_OUTBOX_DRAIN_INTERVAL_NAME, AUDIT_OUTBOX_DRAIN_INTERVAL_MS)
  async tick(): Promise<void> {
    if (this.draining) return; // in-instance overlap guard
    this.draining = true;
    try {
      await this.sweepStuck();
      await this.drainOnce();
    } catch (e) {
      this.logger.error(`[audit-outbox] drain tick failed: ${(e as Error).message}`);
    } finally {
      this.draining = false;
    }
  }

  /**
   * Return rows orphaned in `processing` (crashed mid-drain) to `pending`.
   * Idempotent; safe to run from every instance each tick.
   */
  async sweepStuck(): Promise<number> {
    const cutoff = new Date(Date.now() - AUDIT_OUTBOX_STUCK_PROCESSING_MS);
    const swept = await this.prisma.auditOutbox.updateMany({
      where: { status: 'processing', updatedAt: { lt: cutoff } },
      data: { status: 'pending' },
    });
    if (swept.count > 0) {
      this.logger.warn(`[audit-outbox] swept ${swept.count} stuck 'processing' row(s) back to pending`);
    }
    return swept.count;
  }

  /**
   * Claim one batch and deliver each row. Returns the number of rows delivered.
   */
  async drainOnce(): Promise<number> {
    // Atomic claim: flip a batch of pending rows to 'processing' and return them.
    // SKIP LOCKED lets concurrent instances claim disjoint batches.
    const claimed = await this.prisma.$queryRaw<ClaimedRow[]>`
      UPDATE "platform_audit_outbox"
      SET "status" = 'processing', "updated_at" = now()
      WHERE "id" IN (
        SELECT "id" FROM "platform_audit_outbox"
        WHERE "status" = 'pending'
        ORDER BY "created_at"
        LIMIT ${AUDIT_OUTBOX_BATCH_SIZE}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING "id", "tenant_id", "user_id", "action", "entity_type", "entity_id",
                "old_values", "new_values", "ip_address", "user_agent",
                "attempts", "created_at"
    `;

    let delivered = 0;
    for (const row of claimed) {
      if (await this.deliverRow(row)) delivered += 1;
    }
    return delivered;
  }

  /** Deliver a single claimed row; on failure retry or dead-letter. */
  private async deliverRow(row: ClaimedRow): Promise<boolean> {
    try {
      // Idempotent terminal insert: audit_logs.id = outbox.id + skipDuplicates
      // (ON CONFLICT DO NOTHING) ⇒ a re-drained row never duplicates.
      await this.prisma.platformAuditLog.createMany({
        data: [
          {
            id: row.id,
            tenantId: row.tenant_id ?? undefined,
            userId: row.user_id,
            action: row.action,
            entityType: row.entity_type,
            entityId: row.entity_id,
            oldValues: row.old_values as unknown as undefined,
            newValues: row.new_values as unknown as undefined,
            ipAddress: row.ip_address ?? undefined,
            userAgent: row.user_agent ?? undefined,
            createdAt: row.created_at, // preserve original event time
          },
        ],
        skipDuplicates: true,
      });

      await this.prisma.auditOutbox.update({
        where: { id: row.id },
        data: { status: 'delivered', auditLogId: row.id, processedAt: new Date() },
      });

      this.deliveredCounter.inc();
      return true;
    } catch (e) {
      const attempts = row.attempts + 1;
      const dead = attempts >= AUDIT_OUTBOX_MAX_ATTEMPTS;
      const lastError = (e as Error).message?.slice(0, AUDIT_OUTBOX_LAST_ERROR_MAXLEN);

      await this.prisma.auditOutbox.update({
        where: { id: row.id },
        data: {
          status: dead ? 'failed' : 'pending', // pending ⇒ retried next tick
          attempts,
          lastError,
        },
      });

      if (dead) {
        this.failedCounter.inc();
        this.logger.error(
          `[audit-outbox] row ${row.id} (action=${row.action}) dead-lettered ` +
            `after ${attempts} attempts: ${lastError}`,
        );
      } else {
        this.logger.warn(
          `[audit-outbox] row ${row.id} delivery failed (attempt ${attempts}/` +
            `${AUDIT_OUTBOX_MAX_ATTEMPTS}), will retry: ${lastError}`,
        );
      }
      return false;
    }
  }
}
