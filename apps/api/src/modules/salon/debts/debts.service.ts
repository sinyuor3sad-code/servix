import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantPrismaClient } from '../../../shared/types';
import { CreateEmployeeDebtDto, CreateClientDebtDto } from './dto/create-debt.dto';

@Injectable()
export class DebtsService {
  // ─── Employee Debts ───
  async getEmployeeDebts(db: TenantPrismaClient) {
    const debts = await db.employeeDebt.findMany({
      include: { employee: { select: { id: true, fullName: true, phone: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return debts.map((d: any) => ({ ...d, amount: Number(d.amount) }));
  }

  async createEmployeeDebt(db: TenantPrismaClient, dto: CreateEmployeeDebtDto) {
    const debt = await db.employeeDebt.create({
      data: {
        employeeId: dto.employeeId,
        amount: dto.amount,
        description: dto.description,
        type: dto.type || 'advance',
        date: new Date(dto.date),
      },
    });
    return { ...debt, amount: Number(debt.amount) };
  }

  async markEmployeeDebtPaid(db: TenantPrismaClient, id: string) {
    const debt = await db.employeeDebt.findUnique({ where: { id } });
    if (!debt) throw new NotFoundException('الدين غير موجود');
    const updated = await db.employeeDebt.update({
      where: { id },
      data: { isPaid: true, paidAt: new Date() },
    });
    return { ...updated, amount: Number(updated.amount) };
  }

  async deleteEmployeeDebt(db: TenantPrismaClient, id: string) {
    await db.employeeDebt.delete({ where: { id } });
    return { message: 'تم الحذف' };
  }

  // ─── Client Debts ───
  async getClientDebts(db: TenantPrismaClient) {
    const debts = await db.clientDebt.findMany({
      include: {
        client: { select: { id: true, fullName: true, phone: true } },
        invoice: { select: { id: true, total: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return debts.map((d: any) => ({
      ...d,
      amount: Number(d.amount),
      invoice: d.invoice ? { ...d.invoice, total: Number(d.invoice.total) } : null,
    }));
  }

  async createClientDebt(db: TenantPrismaClient, dto: CreateClientDebtDto) {
    const debt = await db.clientDebt.create({
      data: {
        clientId: dto.clientId,
        invoiceId: dto.invoiceId,
        amount: dto.amount,
        description: dto.description,
        date: new Date(dto.date),
      },
    });
    return { ...debt, amount: Number(debt.amount) };
  }

  async markClientDebtPaid(db: TenantPrismaClient, id: string) {
    const debt = await db.clientDebt.findUnique({ where: { id } });
    if (!debt) throw new NotFoundException('الدين غير موجود');
    const updated = await db.clientDebt.update({
      where: { id },
      data: { isPaid: true, paidAt: new Date() },
    });
    return { ...updated, amount: Number(updated.amount) };
  }

  async deleteClientDebt(db: TenantPrismaClient, id: string) {
    await db.clientDebt.delete({ where: { id } });
    return { message: 'تم الحذف' };
  }

  // ─── Summary ───
  async getSummary(db: TenantPrismaClient) {
    const [empDebts, clientDebts] = await Promise.all([
      db.employeeDebt.findMany({ where: { isPaid: false } }),
      db.clientDebt.findMany({ where: { isPaid: false } }),
    ]);
    return {
      employeeTotalDebt: empDebts.reduce((s: number, d: any) => s + Number(d.amount), 0),
      employeeDebtCount: empDebts.length,
      clientTotalDebt: clientDebts.reduce((s: number, d: any) => s + Number(d.amount), 0),
      clientDebtCount: clientDebts.length,
    };
  }
}
