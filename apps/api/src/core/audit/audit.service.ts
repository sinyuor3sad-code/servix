import { Injectable, NotFoundException } from '@nestjs/common';
import { PlatformPrismaClient } from '../../shared/database/platform.client';
import type { PlatformAuditLog, User } from '../../shared/database';
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

  async log(data: CreateAuditLogData): Promise<PlatformAuditLog> {
    return this.prisma.platformAuditLog.create({
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
      },
    });
  }
}
