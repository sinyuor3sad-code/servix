import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import type {
  Product,
  ProductCategory,
  ServiceProduct,
} from '../../../../generated/tenant';
import { TenantPrismaClient } from '@shared/types';
import {
  CreateProductDto,
  UpdateProductDto,
  CreateProductCategoryDto,
} from './dto/create-product.dto';
import { CreateMovementDto } from './dto/create-movement.dto';
import { LinkServiceProductDto } from './dto/link-service-product.dto';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  async listProducts(db: TenantPrismaClient): Promise<Product[]> {
    return db.product.findMany({
      orderBy: { nameAr: 'asc' },
      include: { category: true },
    });
  }

  async createProduct(db: TenantPrismaClient, dto: CreateProductDto): Promise<Product> {
    // Validate category exists
    const category = await db.productCategory.findUnique({
      where: { id: dto.categoryId },
    });
    if (!category) {
      throw new NotFoundException('فئة المنتج غير موجودة');
    }

    return db.product.create({
      data: {
        categoryId: dto.categoryId,
        nameAr: dto.nameAr,
        nameEn: dto.nameEn,
        sku: dto.sku,
        unit: dto.unit ?? 'قطعة',
        costPrice: dto.costPrice,
        sellPrice: dto.sellPrice ?? 0,
        minStock: dto.minStock ?? 0,
        isActive: dto.isActive ?? true,
      },
      include: { category: true },
    });
  }

  async updateProduct(
    db: TenantPrismaClient,
    id: string,
    dto: UpdateProductDto,
  ): Promise<Product> {
    const existing = await db.product.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('المنتج غير موجود');
    }

    const data: Record<string, unknown> = {};
    if (dto.categoryId !== undefined) data.categoryId = dto.categoryId;
    if (dto.nameAr !== undefined) data.nameAr = dto.nameAr;
    if (dto.nameEn !== undefined) data.nameEn = dto.nameEn;
    if (dto.sku !== undefined) data.sku = dto.sku;
    if (dto.unit !== undefined) data.unit = dto.unit;
    if (dto.costPrice !== undefined) data.costPrice = dto.costPrice;
    if (dto.sellPrice !== undefined) data.sellPrice = dto.sellPrice;
    if (dto.minStock !== undefined) data.minStock = dto.minStock;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    return db.product.update({
      where: { id },
      data,
      include: { category: true },
    });
  }

  async listCategories(db: TenantPrismaClient): Promise<ProductCategory[]> {
    return db.productCategory.findMany({
      orderBy: { sortOrder: 'asc' },
    });
  }

  async createCategory(
    db: TenantPrismaClient,
    dto: CreateProductCategoryDto,
  ): Promise<ProductCategory> {
    return db.productCategory.create({
      data: {
        nameAr: dto.nameAr,
        nameEn: dto.nameEn,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  /**
   * Record a stock movement and adjust product currentStock in a transaction.
   */
  async recordMovement(
    db: TenantPrismaClient,
    productId: string,
    dto: CreateMovementDto,
  ): Promise<void> {
    const product = await db.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw new NotFoundException('المنتج غير موجود');
    }

    // Determine stock change direction
    const isIncrease = dto.type === 'purchase' || dto.type === 'return_to_supplier';
    const stockDelta = isIncrease ? dto.quantity : -dto.quantity;

    await db.$transaction(async (tx) => {
      // Create movement record
      await tx.inventoryMovement.create({
        data: {
          productId,
          type: dto.type,
          quantity: dto.quantity,
          referenceType: dto.referenceType,
          referenceId: dto.referenceId,
          note: dto.note,
          createdBy: dto.createdBy,
        },
      });

      // Update current stock
      await tx.product.update({
        where: { id: productId },
        data: {
          currentStock: { increment: stockDelta },
        },
      });
    });

    this.logger.log(
      `Stock movement: ${dto.type} ${dto.quantity} of product ${productId} (delta: ${stockDelta})`,
    );
  }

  async listLowStock(db: TenantPrismaClient): Promise<Product[]> {
    // Use raw comparison since Prisma doesn't support col-to-col filters easily
    const products = await db.product.findMany({
      where: { isActive: true },
      include: { category: true },
    });
    return products.filter((p) => Number(p.currentStock) < Number(p.minStock));
  }

  /**
   * Link a product to a service with quantity consumed per use.
   * Uses upsert in case the link already exists.
   */
  async linkProductToService(
    db: TenantPrismaClient,
    serviceId: string,
    dto: LinkServiceProductDto,
  ): Promise<ServiceProduct> {
    return db.serviceProduct.upsert({
      where: {
        serviceId_productId: {
          serviceId,
          productId: dto.productId,
        },
      },
      update: {
        quantityPerUse: dto.quantityPerUse,
      },
      create: {
        serviceId,
        productId: dto.productId,
        quantityPerUse: dto.quantityPerUse,
      },
    });
  }

  /**
   * Auto-deduct inventory for a completed appointment.
   * For each service in the appointment, subtract the linked products' quantities.
   */
  async autoDeductForAppointment(
    db: TenantPrismaClient,
    appointmentId: string,
  ): Promise<void> {
    const appointment = await db.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        appointmentServices: {
          include: {
            service: {
              include: { serviceProducts: { include: { product: true } } },
            },
          },
        },
      },
    });

    if (!appointment || appointment.inventoryDeducted) return;

    await db.$transaction(async (tx) => {
      for (const apptService of appointment.appointmentServices) {
        for (const sp of apptService.service.serviceProducts) {
          const qty = Number(sp.quantityPerUse);
          if (qty <= 0) continue;

          // Record consumption movement
          await tx.inventoryMovement.create({
            data: {
              productId: sp.productId,
              type: 'consumption',
              quantity: qty,
              referenceType: 'appointment',
              referenceId: appointmentId,
              note: `استهلاك تلقائي — خدمة ${apptService.service.nameAr}`,
              createdBy: appointment.employeeId ?? 'system',
            },
          });

          // Decrement stock
          await tx.product.update({
            where: { id: sp.productId },
            data: {
              currentStock: { decrement: qty },
            },
          });
        }
      }

      // Mark appointment as inventory-deducted
      await tx.appointment.update({
        where: { id: appointmentId },
        data: { inventoryDeducted: true },
      });
    });

    this.logger.log(`Auto-deducted inventory for appointment ${appointmentId}`);
  }
}
