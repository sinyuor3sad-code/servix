import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantPrismaClient } from '../../../shared/types';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { QueryExpensesDto } from './dto/query-expenses.dto';

interface PaginationMeta {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

@Injectable()
export class ExpensesService {
  private mapDecimalFields<
    T extends { amount: { toNumber?: () => number } | number },
  >(record: T): T & { amount: number } {
    return {
      ...record,
      amount:
        typeof record.amount === 'number'
          ? record.amount
          : Number(record.amount),
    };
  }

  async findAll(
    db: TenantPrismaClient,
    query: QueryExpensesDto,
  ): Promise<PaginatedResult<Record<string, unknown>>> {
    const { page, perPage, category, dateFrom, dateTo } = query;
    const skip = (page - 1) * perPage;

    const where: Record<string, unknown> = {};
    if (category) where.category = category;
    if (dateFrom || dateTo) {
      const dateFilter: Record<string, Date> = {};
      if (dateFrom) dateFilter.gte = new Date(dateFrom);
      if (dateTo) dateFilter.lte = new Date(dateTo);
      where.date = dateFilter;
    }

    const [expenses, total] = await Promise.all([
      db.expense.findMany({
        where,
        skip,
        take: perPage,
        orderBy: { date: 'desc' },
      }),
      db.expense.count({ where }),
    ]);

    return {
      data: expenses.map((e) => this.mapDecimalFields(e)),
      meta: {
        page,
        perPage,
        total,
        totalPages: Math.ceil(total / perPage),
      },
    };
  }

  async findOne(
    db: TenantPrismaClient,
    id: string,
  ): Promise<Record<string, unknown>> {
    const expense = await db.expense.findUnique({ where: { id } });

    if (!expense) {
      throw new NotFoundException('المصروف غير موجود');
    }

    return this.mapDecimalFields(expense);
  }

  async create(
    db: TenantPrismaClient,
    dto: CreateExpenseDto,
    userId: string,
  ): Promise<Record<string, unknown>> {
    const expense = await db.expense.create({
      data: {
        category: dto.category,
        description: dto.description,
        amount: dto.amount,
        date: new Date(dto.date),
        receiptUrl: dto.receiptUrl,
        createdBy: userId,
      },
    });

    return this.mapDecimalFields(expense);
  }

  async update(
    db: TenantPrismaClient,
    id: string,
    dto: UpdateExpenseDto,
  ): Promise<Record<string, unknown>> {
    const existing = await db.expense.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('المصروف غير موجود');
    }

    const data: Record<string, unknown> = { ...dto };
    if (dto.date) {
      data.date = new Date(dto.date);
    }

    const expense = await db.expense.update({
      where: { id },
      data,
    });

    return this.mapDecimalFields(expense);
  }

  async remove(
    db: TenantPrismaClient,
    id: string,
  ): Promise<Record<string, unknown>> {
    const existing = await db.expense.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('المصروف غير موجود');
    }

    await db.expense.delete({ where: { id } });

    return { deleted: true };
  }
}
