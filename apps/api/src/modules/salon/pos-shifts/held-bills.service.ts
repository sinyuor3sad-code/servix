import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TenantPrismaClient } from '../../../shared/types';
import { CreateHeldBillDto } from './dto/create-held-bill.dto';

@Injectable()
export class HeldBillsService {
  /** All held bills for the current open shift, newest first. */
  async list(db: TenantPrismaClient): Promise<Record<string, unknown>[]> {
    const shift = await db.posShift.findFirst({
      where: { status: 'open' },
      orderBy: { openedAt: 'desc' },
      select: { id: true },
    });
    if (!shift) return [];

    const bills = await db.posHeldBill.findMany({
      where: { shiftId: shift.id },
      orderBy: { createdAt: 'desc' },
      include: {
        client: { select: { id: true, fullName: true, phone: true } },
      },
    });

    return bills.map((bill) => this.serialize(bill));
  }

  async create(
    db: TenantPrismaClient,
    dto: CreateHeldBillDto,
    userId: string,
  ): Promise<Record<string, unknown>> {
    const shift = await db.posShift.findUnique({
      where: { id: dto.shiftId },
      select: { id: true, status: true },
    });
    if (!shift) throw new NotFoundException('الوردية غير موجودة');
    if (shift.status !== 'open') {
      throw new BadRequestException('لا يمكن تعليق فاتورة على وردية مغلقة');
    }

    if (!dto.cart.length) {
      throw new BadRequestException('السلة فارغة');
    }

    const bill = await db.posHeldBill.create({
      data: {
        shiftId: shift.id,
        terminalId: dto.terminalId ?? null,
        label: dto.label.trim() || `فاتورة ${new Date().toISOString().slice(11, 16)}`,
        cart: dto.cart as unknown as object,
        clientId: dto.clientId ?? null,
        walkInName: dto.walkInName?.trim() || null,
        walkInPhone: dto.walkInPhone?.trim() || null,
        globalDiscount: dto.globalDiscount ?? '',
        globalDiscountType: dto.globalDiscountType ?? 'fixed',
        total: dto.total,
        createdBy: userId,
      },
      include: {
        client: { select: { id: true, fullName: true, phone: true } },
      },
    });

    return this.serialize(bill);
  }

  async remove(db: TenantPrismaClient, id: string): Promise<void> {
    const bill = await db.posHeldBill.findUnique({ where: { id }, select: { id: true } });
    if (!bill) throw new NotFoundException('الفاتورة المعلّقة غير موجودة');
    await db.posHeldBill.delete({ where: { id } });
  }

  private serialize(bill: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = { ...bill };
    if (out.total !== undefined && out.total !== null) {
      out.total = Number(out.total);
    }
    return out;
  }
}
