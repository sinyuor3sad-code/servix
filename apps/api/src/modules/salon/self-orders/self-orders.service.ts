import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import type { TenantPrismaClient } from '../../../shared/types/tenant-db.type';
import { EventsGateway } from '../../../shared/events/events.gateway';

const MONTH_LETTERS = 'ABCDEFGHIJKL';

@Injectable()
export class SelfOrdersService {
  private readonly logger = new Logger(SelfOrdersService.name);

  constructor(private readonly eventsGateway: EventsGateway) {}

  /* ════════════════════════════════════════
     GET PENDING ORDERS
     ════════════════════════════════════════ */
  async findPending(db: TenantPrismaClient) {
    const now = new Date();
    const orders = await db.selfOrder.findMany({
      where: {
        status: 'pending',
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        orderCode: true,
        services: true,
        totalEstimate: true,
        createdAt: true,
        expiresAt: true,
      },
    });

    return orders.map((o: Record<string, unknown>) => ({
      ...o,
      totalEstimate: Number(o.totalEstimate),
    }));
  }

  /* ════════════════════════════════════════
     GET ORDER BY CODE
     ════════════════════════════════════════ */
  async findByCode(db: TenantPrismaClient, code: string) {
    const upperCode = code.toUpperCase();
    // Extract monthLetter from the order code itself (first character).
    // Previously used now.getMonth() which caused orders to "disappear"
    // when checked after a month boundary.
    const monthLetter = upperCode.charAt(0);

    if (!MONTH_LETTERS.includes(monthLetter)) {
      throw new NotFoundException('رمز الطلب غير صالح');
    }

    const order = await db.selfOrder.findUnique({
      where: {
        orderCode_monthLetter: {
          orderCode: upperCode,
          monthLetter,
        },
      },
    });

    if (!order) {
      throw new NotFoundException('الطلب غير موجود أو منتهي الصلاحية');
    }

    if (order.status === 'expired') {
      throw new NotFoundException('انتهت صلاحية الطلب');
    }

    return {
      id: order.id,
      orderCode: order.orderCode,
      status: order.status,
      services: order.services,
      totalEstimate: Number(order.totalEstimate),
      expiresAt: order.expiresAt.toISOString(),
      createdAt: order.createdAt.toISOString(),
      claimedAt: order.claimedAt?.toISOString() ?? null,
    };
  }

  /* ════════════════════════════════════════
     CLAIM ORDER
     ════════════════════════════════════════ */
  async claim(
    db: TenantPrismaClient,
    code: string,
    tenantSlug: string,
  ) {
    const upperCode = code.toUpperCase();
    // Extract monthLetter from the order code itself (first character).
    const monthLetter = upperCode.charAt(0);

    if (!MONTH_LETTERS.includes(monthLetter)) {
      throw new NotFoundException('رمز الطلب غير صالح');
    }

    const order = await db.selfOrder.findUnique({
      where: {
        orderCode_monthLetter: {
          orderCode: upperCode,
          monthLetter,
        },
      },
    });

    if (!order) {
      throw new NotFoundException('الطلب غير موجود');
    }

    if (order.status !== 'pending') {
      throw new ConflictException(
        order.status === 'claimed'
          ? 'هذا الطلب مأخوذ من كاشيرة أخرى'
          : order.status === 'expired'
            ? 'انتهت صلاحية الطلب'
            : `الطلب في حالة غير صالحة: ${order.status}`,
      );
    }

    // Check if expired by time (cron may not have caught it yet)
    if (order.expiresAt < now) {
      await db.selfOrder.update({
        where: { id: order.id },
        data: { status: 'expired' },
      });
      throw new NotFoundException('انتهت صلاحية الطلب');
    }

    const updated = await db.selfOrder.update({
      where: { id: order.id },
      data: {
        status: 'claimed',
        claimedAt: now,
      },
    });

    // Notify customer's phone via WebSocket
    this.eventsGateway.emitToOrder(
      tenantSlug,
      code.toUpperCase(),
      'order:status',
      { status: 'claimed' },
    );

    this.logger.log(`Order ${code} claimed`);

    return {
      id: updated.id,
      orderCode: updated.orderCode,
      status: updated.status,
      services: updated.services,
      totalEstimate: Number(updated.totalEstimate),
      claimedAt: updated.claimedAt?.toISOString(),
    };
  }
}
