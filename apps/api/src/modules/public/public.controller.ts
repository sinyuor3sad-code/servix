import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Res,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { Public } from '../../shared/decorators/public.decorator';
import { PlatformPrismaClient } from '../../shared/database/platform.client';
import { TenantClientFactory } from '../../shared/database/tenant-client.factory';
import { PublicService } from './public.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { SubmitFeedbackDto } from './dto/submit-feedback.dto';
import { EventsGateway } from '../../shared/events/events.gateway';

@ApiTags('Public — Smart Menu')
@Controller('public')
@Public()
export class PublicController {
  private readonly logger = new Logger(PublicController.name);

  constructor(
    private readonly publicService: PublicService,
    private readonly platformPrisma: PlatformPrismaClient,
    private readonly tenantClientFactory: TenantClientFactory,
    private readonly eventsGateway: EventsGateway,
  ) {}

  /* ── Resolve tenant DB from slug ── */
  private async resolveTenant(slug: string) {
    const tenant = await this.platformPrisma.tenant.findUnique({
      where: { slug },
      select: { id: true, databaseName: true, status: true },
    });

    if (!tenant || tenant.status === 'suspended') {
      throw new NotFoundException('الصالون غير موجود');
    }

    return {
      tenantId: tenant.id,
      db: this.tenantClientFactory.getTenantClient(tenant.databaseName),
    };
  }

  /* ════════════════════════════════════════
     GET /public/:tenantSlug/menu
     ════════════════════════════════════════ */
  @Get(':tenantSlug/menu')
  @ApiOperation({ summary: 'جلب المنيو الذكي — عام بدون تسجيل دخول' })
  @ApiParam({ name: 'tenantSlug', description: 'معرّف الصالون (slug)' })
  @ApiResponse({ status: 200, description: 'بيانات الصالون والخدمات' })
  @ApiResponse({ status: 404, description: 'الصالون غير موجود' })
  async getMenu(@Param('tenantSlug') slug: string) {
    this.logger.log(`[Menu] Fetching menu for: ${slug}`);
    const { db } = await this.resolveTenant(slug);
    return this.publicService.getMenu(db);
  }

  /* ════════════════════════════════════════
     POST /public/:tenantSlug/order
     ════════════════════════════════════════ */
  @Post(':tenantSlug/order')
  @ApiOperation({ summary: 'إنشاء طلب ذاتي من المنيو' })
  @ApiParam({ name: 'tenantSlug', description: 'معرّف الصالون (slug)' })
  @ApiResponse({ status: 201, description: 'تم إنشاء الطلب بنجاح' })
  @ApiResponse({ status: 400, description: 'بيانات غير صالحة' })
  @ApiResponse({ status: 404, description: 'الصالون غير موجود' })
  async createOrder(
    @Param('tenantSlug') slug: string,
    @Body() dto: CreateOrderDto,
  ) {
    this.logger.log(`[Order] Creating order for: ${slug}`);
    const { tenantId, db } = await this.resolveTenant(slug);
    const order = await this.publicService.createOrder(db, dto);

    // Notify POS dashboard via WebSocket that a new order arrived
    this.eventsGateway.emitToTenant(tenantId, 'order:new', {
      orderCode: order.orderCode,
      totalEstimate: order.totalEstimate,
      services: order.services,
    });

    return order;
  }

  /* ════════════════════════════════════════
     GET /public/:tenantSlug/order/:code
     ════════════════════════════════════════ */
  @Get(':tenantSlug/order/:code')
  @ApiOperation({ summary: 'جلب حالة الطلب' })
  @ApiParam({ name: 'tenantSlug', description: 'معرّف الصالون (slug)' })
  @ApiParam({ name: 'code', description: 'رمز الطلب (مثل A001)' })
  @ApiResponse({ status: 200, description: 'بيانات الطلب' })
  @ApiResponse({ status: 404, description: 'الطلب غير موجود' })
  async getOrder(
    @Param('tenantSlug') slug: string,
    @Param('code') code: string,
  ) {
    const { db } = await this.resolveTenant(slug);
    return this.publicService.getOrder(db, code);
  }

  /* ════════════════════════════════════════
     GET /public/:tenantSlug/invoice/:token
     ════════════════════════════════════════ */
  @Get(':tenantSlug/invoice/:token')
  @ApiOperation({ summary: 'جلب الفاتورة العامة بالتوكن — بدون تسجيل دخول' })
  @ApiParam({ name: 'tenantSlug', description: 'معرّف الصالون (slug)' })
  @ApiParam({ name: 'token', description: 'التوكن العام للفاتورة' })
  @ApiResponse({ status: 200, description: 'بيانات الفاتورة' })
  @ApiResponse({ status: 404, description: 'الرابط غير صالح' })
  async getInvoice(
    @Param('tenantSlug') slug: string,
    @Param('token') token: string,
  ) {
    this.logger.log(`[Invoice] Fetching invoice for: ${slug} / token: ${token.slice(0, 8)}...`);
    const { db } = await this.resolveTenant(slug);
    const result = await this.publicService.getInvoiceByToken(db, token);
    if (!result) {
      throw new NotFoundException('هذا الرابط لم يعد صالحاً');
    }
    return result;
  }

  /* ════════════════════════════════════════
     POST /public/:tenantSlug/invoice/:token/feedback
     ════════════════════════════════════════ */
  @Post(':tenantSlug/invoice/:token/feedback')
  @ApiOperation({ summary: 'إرسال تقييم على الفاتورة' })
  @ApiParam({ name: 'tenantSlug', description: 'معرّف الصالون (slug)' })
  @ApiParam({ name: 'token', description: 'التوكن العام للفاتورة' })
  @ApiResponse({ status: 201, description: 'تم إرسال التقييم' })
  @ApiResponse({ status: 404, description: 'الرابط غير صالح' })
  @ApiResponse({ status: 409, description: 'تم التقييم مسبقاً' })
  async submitFeedback(
    @Param('tenantSlug') slug: string,
    @Param('token') token: string,
    @Body() dto: SubmitFeedbackDto,
  ) {
    this.logger.log(`[Feedback] Submitting for: ${slug} / token: ${token.slice(0, 8)}...`);
    const { db } = await this.resolveTenant(slug);
    const result = await this.publicService.submitFeedback(db, token, dto);
    if (result.error === 'not_found') {
      throw new NotFoundException('هذا الرابط لم يعد صالحاً');
    }
    if (result.error === 'already_exists') {
      throw new ConflictException('تم التقييم مسبقاً');
    }
    return {
      success: true,
      rating: dto.rating,
      showGooglePrompt: result.showGooglePrompt ?? false,
    };
  }

  /* ════════════════════════════════════════
     PATCH /public/:tenantSlug/invoice/:token/feedback/google-clicked
     ════════════════════════════════════════ */
  @Patch(':tenantSlug/invoice/:token/feedback/google-clicked')
  @ApiOperation({ summary: 'تسجيل نقرة Google Maps' })
  @ApiParam({ name: 'tenantSlug', description: 'معرّف الصالون (slug)' })
  @ApiParam({ name: 'token', description: 'التوكن العام للفاتورة' })
  @ApiResponse({ status: 200, description: 'تم التسجيل' })
  async trackGoogleClick(
    @Param('tenantSlug') slug: string,
    @Param('token') token: string,
  ) {
    this.logger.log(`[GoogleClick] Tracking for: ${slug} / token: ${token.slice(0, 8)}...`);
    const { db } = await this.resolveTenant(slug);
    await this.publicService.trackGoogleClick(db, token);
    return { success: true };
  }

  /* ════════════════════════════════════════
     GET /public/tap/:salonSlug/:terminalId
     NFC Tap-to-Invoice — public, no auth
     ════════════════════════════════════════ */
  @Get('tap/:salonSlug/:terminalId')
  @ApiOperation({ summary: 'NFC Tap — جلب فاتورة العميلة من الـ terminal' })
  @ApiParam({ name: 'salonSlug', description: 'معرّف الصالون (slug)' })
  @ApiParam({ name: 'terminalId', description: 'معرّف جهاز الكاشير' })
  @ApiResponse({ status: 302, description: 'Redirect to invoice or no-invoice page' })
  async nfcTap(
    @Param('salonSlug') slug: string,
    @Param('terminalId') terminalId: string,
    @Res() res: Response,
  ) {
    this.logger.log(`[NFC] Tap from terminal ${terminalId} for salon ${slug}`);

    // 1. Resolve tenant
    let tenantDb: ReturnType<typeof this.tenantClientFactory.getTenantClient>;
    try {
      const { db } = await this.resolveTenant(slug);
      tenantDb = db;
    } catch {
      return res.redirect(`/${slug}/no-invoice`);
    }

    // 2. Find oldest unclaimed paid invoice from this terminal (last 30 min)
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
    const invoice = await tenantDb.invoice.findFirst({
      where: {
        terminalId: terminalId,
        nfcClaimedAt: null,
        status: 'paid',
        createdAt: { gte: thirtyMinAgo },
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true, publicToken: true },
    });

    if (!invoice || !invoice.publicToken) {
      return res.redirect(`/${slug}/no-invoice`);
    }

    // 3. Atomic claim — prevents race conditions
    const claimed = await tenantDb.invoice.updateMany({
      where: {
        id: invoice.id,
        nfcClaimedAt: null, // atomic condition
      },
      data: {
        nfcClaimedAt: new Date(),
      },
    });

    if (claimed.count === 0) {
      // Someone else claimed it
      return res.redirect(`/${slug}/no-invoice`);
    }

    // 4. Redirect to public invoice page
    return res.redirect(`/${slug}/invoice/${invoice.publicToken}`);
  }
}
