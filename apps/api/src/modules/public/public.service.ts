import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import type { TenantPrismaClient } from '../../shared/types/tenant-db.type';
import { CreateOrderDto } from './dto/create-order.dto';

const MONTH_LETTERS = 'ABCDEFGHIJKL';

interface ServiceRecord {
  id: string;
  nameAr: string;
  nameEn: string | null;
  price: number | { toNumber?: () => number };
  duration: number;
}

interface CategoryWithServices {
  id: string;
  nameAr: string;
  nameEn: string | null;
  services: Array<{
    id: string;
    nameAr: string;
    nameEn: string | null;
    price: number | { toNumber?: () => number };
    duration: number;
    categoryId: string;
    imageUrl: string | null;
  }>;
}

@Injectable()
export class PublicService {
  private readonly logger = new Logger(PublicService.name);

  /* ================================================================
     GET MENU — salon info + categories + active services
     ================================================================ */
  async getMenu(db: TenantPrismaClient) {
    const [salon, categories] = await Promise.all([
      db.salonInfo.findFirst(),
      db.serviceCategory.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        include: {
          services: {
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' },
            select: {
              id: true,
              nameAr: true,
              nameEn: true,
              price: true,
              duration: true,
              categoryId: true,
              imageUrl: true,
            },
          },
        },
      }),
    ]);

    if (!salon) {
      throw new NotFoundException('الصالون غير موجود');
    }

    const cats = categories as unknown as CategoryWithServices[];

    return {
      salon: {
        nameAr: salon.nameAr,
        nameEn: salon.nameEn,
        logoUrl: salon.logoUrl,
        coverImageUrl: salon.coverImageUrl,
        brandColorPreset: salon.brandColorPreset,
        themeLayout: salon.themeLayout,
        welcomeMessage: salon.welcomeMessage,
        googleMapsUrl: salon.googleMapsUrl,
        currency: salon.currency,
        taxPercentage: Number(salon.taxPercentage),
      },
      categories: cats
        .filter((c: CategoryWithServices) => c.services.length > 0)
        .map((c: CategoryWithServices) => ({
          id: c.id,
          nameAr: c.nameAr,
          nameEn: c.nameEn,
          services: c.services.map((s) => ({
            id: s.id,
            nameAr: s.nameAr,
            nameEn: s.nameEn,
            price: Number(s.price),
            duration: s.duration,
            categoryId: s.categoryId,
            imageUrl: s.imageUrl,
          })),
        })),
    };
  }

  /* ================================================================
     CREATE ORDER — validate services → generate code → save
     ================================================================ */
  async createOrder(db: TenantPrismaClient, dto: CreateOrderDto) {
    const serviceIds = dto.services.map((s) => s.serviceId);

    // Validate all services exist and are active
    const services = await db.service.findMany({
      where: {
        id: { in: serviceIds },
        isActive: true,
      },
      select: {
        id: true,
        nameAr: true,
        nameEn: true,
        price: true,
        duration: true,
      },
    });

    const svcList = services as unknown as ServiceRecord[];

    if (svcList.length !== serviceIds.length) {
      const foundIds = new Set(svcList.map((s: ServiceRecord) => s.id));
      const missing = serviceIds.filter((id) => !foundIds.has(id));
      throw new BadRequestException(
        `خدمات غير موجودة أو غير مفعّلة: ${missing.join(', ')}`,
      );
    }

    // Calculate total estimate
    const totalEstimate = svcList.reduce(
      (sum: number, s: ServiceRecord) => sum + Number(s.price),
      0,
    );

    // Generate order code
    const now = new Date();
    const monthLetter = MONTH_LETTERS[now.getMonth()]; // Jan=A...

    // Find last order code for this month
    const lastOrder = await db.selfOrder.findFirst({
      where: { monthLetter },
      orderBy: { orderCode: 'desc' },
      select: { orderCode: true },
    });

    let nextNumber = 1;
    if (lastOrder) {
      const numPart = parseInt(lastOrder.orderCode.slice(1), 10);
      if (!isNaN(numPart)) {
        nextNumber = numPart + 1;
      }
    }

    if (nextNumber > 999) {
      throw new BadRequestException(
        'تم الوصول للحد الأقصى من الطلبات لهذا الشهر (999)',
      );
    }

    const orderCode = `${monthLetter}${String(nextNumber).padStart(3, '0')}`;
    const expiresAt = new Date(now.getTime() + 30 * 60 * 1000); // 30 minutes

    // Save to database
    const order = await db.selfOrder.create({
      data: {
        orderCode,
        monthLetter,
        status: 'pending',
        services: svcList.map((s: ServiceRecord) => ({
          serviceId: s.id,
          nameAr: s.nameAr,
          nameEn: s.nameEn,
          price: Number(s.price),
          duration: s.duration,
        })),
        totalEstimate,
        expiresAt,
      },
    });

    this.logger.log(`Order created: ${orderCode} (total: ${totalEstimate})`);

    return {
      orderCode: order.orderCode,
      totalEstimate: Number(order.totalEstimate),
      expiresAt: order.expiresAt.toISOString(),
      services: order.services as Array<{
        serviceId: string;
        nameAr: string;
        nameEn: string | null;
        price: number;
        duration: number;
      }>,
    };
  }

  /* ================================================================
     GET ORDER — fetch by code
     ================================================================ */
  async getOrder(db: TenantPrismaClient, code: string) {
    const now = new Date();
    const monthLetter = MONTH_LETTERS[now.getMonth()];

    const order = await db.selfOrder.findUnique({
      where: {
        orderCode_monthLetter: {
          orderCode: code.toUpperCase(),
          monthLetter,
        },
      },
      include: {
        invoice: {
          select: {
            publicToken: true,
            invoiceNumber: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('الطلب غير موجود أو منتهي الصلاحية');
    }

    const result: Record<string, unknown> = {
      id: order.id,
      orderCode: order.orderCode,
      status: order.status,
      services: order.services,
      totalEstimate: Number(order.totalEstimate),
      expiresAt: order.expiresAt.toISOString(),
      createdAt: order.createdAt.toISOString(),
    };

    // If paid, include invoice token for redirect
    if (order.status === 'paid' && order.invoice) {
      result.invoicePublicToken = order.invoice.publicToken;
      result.invoiceNumber = order.invoice.invoiceNumber;
    }

    return result;
  }

  /* ================================================================
     EXPIRE ORDERS — called by cron job
     ================================================================ */
  async expireOrders(db: TenantPrismaClient): Promise<string[]> {
    const now = new Date();

    // Find orders to expire (for WebSocket notification)
    const expiring = await db.selfOrder.findMany({
      where: {
        status: 'pending',
        expiresAt: { lt: now },
      },
      select: { id: true, orderCode: true },
    });

    if (expiring.length === 0) return [];

    // Bulk update
    await db.selfOrder.updateMany({
      where: {
        status: 'pending',
        expiresAt: { lt: now },
      },
      data: { status: 'expired' },
    });

    const codes = expiring.map((o: { id: string; orderCode: string }) => o.orderCode);
    this.logger.log(`Expired ${codes.length} orders: ${codes.join(', ')}`);
    return codes;
  }

  /* ================================================================
     GET INVOICE BY TOKEN — public invoice view
     ================================================================ */
  async getInvoiceByToken(db: TenantPrismaClient, token: string) {
    const invoice = await db.invoice.findFirst({
      where: {
        publicToken: token,
        publicTokenStatus: 'active',
      },
      include: {
        invoiceItems: {
          include: {
            service: { select: { nameAr: true, nameEn: true } },
          },
        },
        client: { select: { fullName: true } },
        feedback: true,
      },
    });

    if (!invoice) return null;

    // Fetch salon branding info
    const salon = await db.salonInfo.findFirst();
    if (!salon) return null;

    const items = (invoice.invoiceItems as Array<{
      description: string;
      quantity: number;
      unitPrice: number | { toNumber?: () => number };
      totalPrice: number | { toNumber?: () => number };
    }>);

    const feedback = invoice.feedback as {
      rating: number;
      comment: string | null;
      createdAt: Date;
    } | null;

    return {
      salon: {
        nameAr: salon.nameAr,
        nameEn: salon.nameEn,
        logoUrl: salon.logoUrl,
        coverImageUrl: salon.coverImageUrl,
        brandColorPreset: salon.brandColorPreset,
        themeLayout: salon.themeLayout,
        googleMapsUrl: salon.googleMapsUrl,
        currency: salon.currency,
      },
      invoice: {
        invoiceNumber: invoice.invoiceNumber,
        subtotal: Number(invoice.subtotal),
        discountAmount: Number(invoice.discountAmount),
        taxAmount: Number(invoice.taxAmount),
        total: Number(invoice.total),
        paidAt: invoice.paidAt ? invoice.paidAt.toISOString() : null,
        items: items.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          totalPrice: Number(item.totalPrice),
        })),
      },
      feedback: feedback
        ? {
            rating: feedback.rating,
            comment: feedback.comment,
            createdAt: feedback.createdAt.toISOString(),
          }
        : null,
    };
  }

  /* ================================================================
     SUBMIT FEEDBACK — customer rating from QR invoice page
     ================================================================ */
  async submitFeedback(
    db: TenantPrismaClient,
    token: string,
    dto: { rating: number; comment?: string; googlePromptShown?: boolean },
  ): Promise<{ success: boolean; error?: string }> {
    // 1. Find invoice by publicToken (active only)
    const invoice = await db.invoice.findFirst({
      where: {
        publicToken: token,
        publicTokenStatus: 'active',
      },
      select: { id: true },
    });

    if (!invoice) {
      return { success: false, error: 'not_found' };
    }

    // 2. Check if feedback already exists
    const existing = await db.invoiceFeedback.findUnique({
      where: { invoiceId: invoice.id },
    });

    if (existing) {
      return { success: false, error: 'already_exists' };
    }

    // 3. Create feedback
    await db.invoiceFeedback.create({
      data: {
        invoiceId: invoice.id,
        rating: dto.rating,
        comment: dto.comment || null,
        source: 'qr',
        googlePromptShown: dto.googlePromptShown ?? false,
      },
    });

    this.logger.log(`Feedback submitted for invoice ${invoice.id}: ${dto.rating}/5`);
    return { success: true };
  }

  /* ================================================================
     TRACK GOOGLE CLICK — when customer clicks Google Maps link
     ================================================================ */
  async trackGoogleClick(
    db: TenantPrismaClient,
    token: string,
  ): Promise<{ success: boolean; error?: string }> {
    // 1. Find invoice by publicToken (active)
    const invoice = await db.invoice.findFirst({
      where: {
        publicToken: token,
        publicTokenStatus: 'active',
      },
      select: { id: true },
    });

    if (!invoice) {
      return { success: false, error: 'not_found' };
    }

    // 2. Find feedback for this invoice
    const feedback = await db.invoiceFeedback.findUnique({
      where: { invoiceId: invoice.id },
    });

    if (!feedback) {
      return { success: false, error: 'not_found' };
    }

    // 3. Update googleClicked
    await db.invoiceFeedback.update({
      where: { id: feedback.id },
      data: { googleClicked: true },
    });

    this.logger.log(`Google click tracked for invoice ${invoice.id}`);
    return { success: true };
  }
}

