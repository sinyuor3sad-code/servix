import { Injectable, NotFoundException } from '@nestjs/common';
import { PlatformPrismaClient } from '../../shared/database/platform.client';
import type { PlatformAuditLog, User } from '../../shared/database';
import type { Prisma } from '../../../generated/platform';
import { QueryAuditLogDto } from './dto/query-audit-log.dto';

export interface CreateAuditLogData {
  tenantId?: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export type AuditLogWithUser = PlatformAuditLog & {
  user: Pick<User, 'id' | 'fullName' | 'email'>;
};

interface PaginatedAuditLogs {
  data: AuditLogWithUser[];
  meta: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PlatformPrismaClient) {}

  async findAll(query: QueryAuditLogDto): Promise<PaginatedAuditLogs> {
    const { page, perPage, sort, order, tenantId, userId, action, entityType, dateFrom, dateTo } =
      query;

    const where: Record<string, unknown> = {};

    if (tenantId) {
      where.tenantId = tenantId;
    }

    if (userId) {
      where.userId = userId;
    }

    if (action) {
      where.action = action;
    }

    if (entityType) {
      where.entityType = entityType;
    }

    if (dateFrom || dateTo) {
      where.createdAt = {
        ...(dateFrom && { gte: new Date(dateFrom) }),
        ...(dateTo && { lte: new Date(dateTo) }),
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.platformAuditLog.findMany({
        where,
        include: {
          user: { select: { id: true, fullName: true, email: true } },
        },
        orderBy: { [sort || 'createdAt']: order || 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      this.prisma.platformAuditLog.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        perPage,
        total,
        totalPages: Math.ceil(total / perPage),
      },
    };
  }

  async findOne(id: string): Promise<AuditLogWithUser> {
    const log = await this.prisma.platformAuditLog.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, fullName: true, email: true } },
      },
    });

    if (!log) {
      throw new NotFoundException('سجل المراجعة غير موجود');
    }

    return log;
  }

  /**
   * V-35b — Record an audit event via the transactional outbox.
   *
   * Instead of writing straight to platform_audit_logs (FK-checked, and
   * historically fire-and-forget so a transient failure was silently lost —
   * A2-18), this stages a row in platform_audit_outbox. AuditOutboxProcessor
   * drains it into platform_audit_logs with at-least-once delivery + retry.
   *
   * Pass `tx` (a platform interactive-transaction client) to make the outbox
   * write atomic with the caller's business write — if the business tx rolls
   * back, the audit row goes with it, and if the outbox insert fails the whole
   * business operation fails. This is the strong "no silent loss" guarantee
   * used on platform-DB flows (auth).
   *
   * Without `tx` the insert is a standalone awaited write. It still throws on
   * failure (fail-loud) — callers that wrap it in `.catch()` (the salon/tenant
   * modules) therefore retain best-effort semantics: reliable for transient
   * failures (the worker retries once the row lands), with a documented gap on
   * a *sustained* outbox outage. Closing that gap fully is the deferred
   * V-35-tenant-atomicity follow-up (gated on the V-77+ tenant-migration
   * toolchain + a PDPL m.12 compliance call with Engineer 4).
   *
   * NOTE: the outbox has no FK by design — referential integrity is enforced
   * on the terminal platform_audit_logs insert during drain.
   */
  async log(data: CreateAuditLogData, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx ?? this.prisma;
    await client.auditOutbox.create({
      data: {
        tenantId: data.tenantId,
        userId: data.userId,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        oldValues: data.oldValues as unknown as undefined,
        newValues: data.newValues as unknown as undefined,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        // status='pending', attempts=0 come from schema defaults.
      },
    });
  }
}
