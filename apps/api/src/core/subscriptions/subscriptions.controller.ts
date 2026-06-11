import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { SubscriptionsService } from './subscriptions.service';
import type { PlanWithFeatures, SubscriptionWithPlan } from './subscriptions.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { JwtAuthGuard, RolesGuard } from '../../shared/guards';
import { CurrentUser, Roles } from '../../shared/decorators';

// V-idor-sweep (MEDIUM): the self-service routes (current/cancel/renew) correctly
// derive the tenant from the JWT via @CurrentUser('tenantId'). POST / was the odd
// one out — it takes an arbitrary tenantId in the body with no role/ownership
// check, so any authenticated user could create/change a subscription for ANY
// tenant. It has no self-service caller (the dashboard only reads
// /subscriptions/current; the admin app provisions via /admin/subscriptions/*),
// so POST / is platform provisioning and is gated to super_admin at the method
// level. RolesGuard is added at the class so @Roles is actually enforced; routes
// without @Roles stay open to any authenticated tenant user (RolesGuard is a
// no-op when no @Roles metadata is present).
@ApiTags('الاشتراكات - Subscriptions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'subscriptions', version: '1' })
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get('plans')
  @ApiOperation({ summary: 'عرض جميع الباقات المتاحة' })
  @ApiResponse({ status: 200, description: 'قائمة الباقات مع المميزات' })
  async getPlans(): Promise<PlanWithFeatures[]> {
    return this.subscriptionsService.getPlans();
  }

  @Get('plans/:id')
  @ApiOperation({ summary: 'عرض تفاصيل باقة محددة' })
  @ApiParam({ name: 'id', description: 'معرف الباقة (UUID)' })
  @ApiResponse({ status: 200, description: 'تفاصيل الباقة مع المميزات' })
  @ApiResponse({ status: 404, description: 'الباقة غير موجودة' })
  async getPlanById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PlanWithFeatures> {
    return this.subscriptionsService.getPlanById(id);
  }

  @Post()
  @Roles('super_admin')
  @ApiOperation({
    summary: 'إنشاء أو تغيير اشتراك منشأة (مدير المنصة فقط)',
    description:
      'عملية منصّية — تأخذ معرّف المنشأة في الجسم. الخدمة الذاتية للمستأجر عبر current/cancel/renew.',
  })
  @ApiResponse({ status: 201, description: 'تم إنشاء الاشتراك بنجاح' })
  @ApiResponse({ status: 403, description: 'غير مصرح — مدير المنصة فقط' })
  @ApiResponse({ status: 404, description: 'الباقة أو المنشأة غير موجودة' })
  async createSubscription(
    @Body() dto: CreateSubscriptionDto,
  ): Promise<SubscriptionWithPlan> {
    return this.subscriptionsService.createSubscription(dto);
  }

  @Get('current')
  @ApiOperation({ summary: 'عرض الاشتراك الحالي' })
  @ApiResponse({ status: 200, description: 'تفاصيل الاشتراك الحالي مع الباقة' })
  @ApiResponse({ status: 404, description: 'لا يوجد اشتراك حالي' })
  async getCurrentSubscription(
    @CurrentUser('tenantId') tenantId: string | undefined,
  ): Promise<SubscriptionWithPlan> {
    if (!tenantId) {
      throw new BadRequestException('لم يتم تحديد المنشأة');
    }
    return this.subscriptionsService.getCurrentSubscription(tenantId);
  }

  @Put('cancel')
  @ApiOperation({ summary: 'إلغاء الاشتراك الحالي' })
  @ApiResponse({ status: 200, description: 'تم إلغاء الاشتراك بنجاح' })
  @ApiResponse({ status: 404, description: 'لا يوجد اشتراك نشط للإلغاء' })
  async cancelSubscription(
    @CurrentUser('tenantId') tenantId: string | undefined,
  ): Promise<SubscriptionWithPlan> {
    if (!tenantId) {
      throw new BadRequestException('لم يتم تحديد المنشأة');
    }
    return this.subscriptionsService.cancelSubscription(tenantId);
  }

  @Put('renew')
  @ApiOperation({ summary: 'تجديد الاشتراك' })
  @ApiResponse({ status: 200, description: 'تم تجديد الاشتراك بنجاح' })
  @ApiResponse({ status: 404, description: 'لا يوجد اشتراك للتجديد' })
  @ApiResponse({ status: 400, description: 'الاشتراك نشط بالفعل' })
  async renewSubscription(
    @CurrentUser('tenantId') tenantId: string | undefined,
  ): Promise<SubscriptionWithPlan> {
    if (!tenantId) {
      throw new BadRequestException('لم يتم تحديد المنشأة');
    }
    return this.subscriptionsService.renewSubscription(tenantId);
  }
}
