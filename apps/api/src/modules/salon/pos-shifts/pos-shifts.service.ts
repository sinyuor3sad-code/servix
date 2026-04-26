import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { TenantPrismaClient } from '../../../shared/types';
import { OpenShiftDto } from './dto/open-shift.dto';
import { CloseShiftDto } from './dto/close-shift.dto';

@Injectable()
export class PosShiftsService {
  private mapDecimals(record: Record<string, unknown>): Record<string, unknown> {
    const decimalFields = [
      'openingBalance', 'closingBalance', 'expectedCash', 'cashDifference',
      'totalSales', 'totalCash', 'totalCard', 'totalTransfer',
      'totalRefunds', 'totalDiscounts', 'totalExpenses',
    ];
    const mapped = { ...record };
    for (const field of decimalFields) {
      if (mapped[field] !== null && mapped[field] !== undefined) {
        mapped[field] = Number(mapped[field]);
      }
    }
    return mapped;
  }

  async getCurrent(db: TenantPrismaClient): Promise<Record<string, unknown> | null> {
    const shift = await db.posShift.findFirst({
      where: { status: 'open' },
      orderBy: { openedAt: 'desc' },
    });
    if (!shift) return null;
    return this.mapDecimals(shift as unknown as Record<string, unknown>);
  }

  async open(
    db: TenantPrismaClient,
    dto: OpenShiftDto,
    userId: string,
  ): Promise<Record<string, unknown>> {
    // Check if there's already an open shift
    const existing = await db.posShift.findFirst({
      where: { status: 'open' },
    });
    if (existing) {
      throw new ConflictException('يوجد وردية مفتوحة بالفعل — أغلقها أولاً');
    }

    const shift = await db.posShift.create({
      data: {
        openedBy: userId,
        openingBalance: dto.openingBalance,
        status: 'open',
      },
    });

    return this.mapDecimals(shift as unknown as Record<string, unknown>);
  }

  async close(
    db: TenantPrismaClient,
    dto: CloseShiftDto,
    userId: string,
  ): Promise<Record<string, unknown>> {
    const shift = await db.posShift.findFirst({
      where: { status: 'open' },
      orderBy: { openedAt: 'desc' },
    });

    if (!shift) {
      throw new NotFoundException('لا توجد وردية مفتوحة');
    }

    const now = new Date();

    // ── Aggregate invoices created during this shift ──
    const invoices = await db.invoice.findMany({
      where: {
        createdAt: { gte: shift.openedAt, lte: now },
        status: { in: ['paid', 'partially_paid'] },
      },
      include: {
        payments: true,
        discounts: true,
      },
    });

    let totalSales = 0;
    let totalCash = 0;
    let totalCard = 0;
    let totalTransfer = 0;
    let totalDiscounts = 0;
    let totalRefunds = 0;
    let totalCashRefunds = 0;
    const invoiceCount = invoices.length;

    for (const inv of invoices) {
      totalSales += Number(inv.total);
      for (const p of inv.payments) {
        const amount = Number(p.amount);
        switch (p.method) {
          case 'cash': totalCash += amount; break;
          case 'card': totalCard += amount; break;
          case 'bank_transfer': totalTransfer += amount; break;
        }
      }
      for (const d of inv.discounts) {
        totalDiscounts += Number(d.amount);
      }
    }

    // ── Refunded invoices ──
    const refunded = await db.invoice.findMany({
      where: {
        refundedAt: { gte: shift.openedAt, lte: now },
      },
      include: { payments: true },
    });
    for (const inv of refunded) {
      totalRefunds += Number(inv.total);
      // Estimate cash portion of refunds
      for (const p of inv.payments) {
        if (p.method === 'cash') totalCashRefunds += Number(p.amount);
      }
    }

    // ── Expenses during shift ──
    const expenses = await db.expense.findMany({
      where: {
        createdAt: { gte: shift.openedAt, lte: now },
      },
    });
    let totalExpenses = 0;
    for (const exp of expenses) {
      totalExpenses += Number(exp.amount);
    }

    // ── Calculate expected cash ──
    const openingBalance = Number(shift.openingBalance);
    const expectedCash = openingBalance + totalCash - totalCashRefunds - totalExpenses;
    const cashDifference = dto.closingBalance - expectedCash;

    // ── Update the shift ──
    const updated = await db.posShift.update({
      where: { id: shift.id },
      data: {
        closedBy: userId,
        closingBalance: dto.closingBalance,
        expectedCash,
        cashDifference,
        totalSales,
        totalCash,
        totalCard,
        totalTransfer,
        totalRefunds,
        totalDiscounts,
        totalExpenses,
        invoiceCount,
        status: 'closed',
        closedAt: now,
        notes: dto.notes || null,
      },
    });

    return this.mapDecimals(updated as unknown as Record<string, unknown>);
  }

  async getReport(
    db: TenantPrismaClient,
    id: string,
  ): Promise<Record<string, unknown>> {
    const shift = await db.posShift.findUnique({ where: { id } });
    if (!shift) {
      throw new NotFoundException('الوردية غير موجودة');
    }
    return this.mapDecimals(shift as unknown as Record<string, unknown>);
  }
}
