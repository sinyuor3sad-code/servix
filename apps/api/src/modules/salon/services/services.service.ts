import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantPrismaClient } from '../../../shared/types';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { ReorderServicesDto } from './dto/reorder.dto';
import { QueryServicesDto } from './dto/query-services.dto';
import { paginate } from '../../../shared/helpers/paginate.helper';


@Injectable()
export class ServicesService {
  private mapServicePrice<
    T extends { price: { toNumber?: () => number } | number },
  >(service: T): T & { price: number } {
    return {
      ...service,
      price:
        typeof service.price === 'number'
          ? service.price
          : Number(service.price),
    };
  }

  async findAll(
    db: TenantPrismaClient,
    query: QueryServicesDto,
  ) {
    const { page, categoryId, isActive } = query;
    const limit = (query as any).limit ?? query.perPage;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (categoryId) where.categoryId = categoryId;
    if (isActive !== undefined) where.isActive = isActive;

    const [services, total] = await Promise.all([
      db.service.findMany({
        where,
        include: { category: true },
        skip,
        take: limit,
        orderBy: { sortOrder: 'asc' },
      }),
      db.service.count({ where }),
    ]);

    return paginate(
      services.map((s) => this.mapServicePrice(s)) as unknown as Record<string, unknown>[],
      total, page, limit,
    );
  }

  async findOne(
    db: TenantPrismaClient,
    id: string,
  ): Promise<Record<string, unknown>> {
    const service = await db.service.findUnique({
      where: { id },
      include: { category: true },
    });

    if (!service) {
      throw new NotFoundException('الخدمة غير موجودة');
    }

    return this.mapServicePrice(service);
  }

  async create(
    db: TenantPrismaClient,
    dto: CreateServiceDto,
  ): Promise<Record<string, unknown>> {
    const category = await db.serviceCategory.findUnique({
      where: { id: dto.categoryId },
    });

    if (!category) {
      throw new NotFoundException('التصنيف غير موجود');
    }

    const service = await db.service.create({
      data: dto,
      include: { category: true },
    });

    return this.mapServicePrice(service);
  }

  async update(
    db: TenantPrismaClient,
    id: string,
    dto: UpdateServiceDto,
  ): Promise<Record<string, unknown>> {
    const existing = await db.service.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('الخدمة غير موجودة');
    }

    if (dto.categoryId) {
      const category = await db.serviceCategory.findUnique({
        where: { id: dto.categoryId },
      });
      if (!category) {
        throw new NotFoundException('التصنيف غير موجود');
      }
    }

    const service = await db.service.update({
      where: { id },
      data: dto,
      include: { category: true },
    });

    return this.mapServicePrice(service);
  }

  async softDelete(
    db: TenantPrismaClient,
    id: string,
  ): Promise<Record<string, unknown>> {
    const existing = await db.service.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('الخدمة غير موجودة');
    }

    const service = await db.service.update({
      where: { id },
      data: { isActive: false },
    });

    return this.mapServicePrice(service);
  }

  async hardDelete(
    db: TenantPrismaClient,
    id: string,
  ): Promise<{ deleted: boolean; message: string }> {
    const existing = await db.service.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('الخدمة غير موجودة');
    }

    try {
      // Try real delete first
      await db.service.delete({ where: { id } });
      return { deleted: true, message: 'تم حذف الخدمة نهائياً' };
    } catch (_e: any) {
      // Foreign key constraint — service used in invoices/appointments
      // Fall back to soft delete
      await db.service.update({ where: { id }, data: { isActive: false } });
      return { deleted: false, message: 'تم تعطيل الخدمة (مرتبطة بفواتير أو مواعيد)' };
    }
  }

  async reorder(
    db: TenantPrismaClient,
    dto: ReorderServicesDto,
  ): Promise<{ updated: number }> {
    const operations = dto.items.map((item) =>
      db.service.update({
        where: { id: item.id },
        data: { sortOrder: item.sortOrder },
      }),
    );

    const results = await db.$transaction(operations);
    return { updated: results.length };
  }

  // ─── Category CRUD ───

  async findAllCategories(
    db: TenantPrismaClient,
  ): Promise<Record<string, unknown>[]> {
    return db.serviceCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: { select: { services: true } },
      },
    });
  }

  async createCategory(
    db: TenantPrismaClient,
    dto: CreateCategoryDto,
  ): Promise<Record<string, unknown>> {
    return db.serviceCategory.create({ data: dto });
  }

  async updateCategory(
    db: TenantPrismaClient,
    id: string,
    dto: UpdateCategoryDto,
  ): Promise<Record<string, unknown>> {
    const existing = await db.serviceCategory.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('التصنيف غير موجود');
    }

    return db.serviceCategory.update({
      where: { id },
      data: dto,
    });
  }

  async deleteCategory(
    db: TenantPrismaClient,
    id: string,
  ): Promise<Record<string, unknown>> {
    const existing = await db.serviceCategory.findUnique({
      where: { id },
      include: { _count: { select: { services: true } } },
    });

    if (!existing) {
      throw new NotFoundException('التصنيف غير موجود');
    }

    return db.serviceCategory.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
