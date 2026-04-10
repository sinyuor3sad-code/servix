import {
  Controller,
  Get,
  Post,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { TenantGuard } from '../../../shared/guards';
import { AuthenticatedRequest } from '../../../shared/types';
import { SelfOrdersService } from './self-orders.service';

@ApiTags('الطلبات الذاتية - Self Orders')
@ApiBearerAuth()
@UseGuards(TenantGuard)
@Controller({ path: 'salon/orders', version: '1' })
export class SelfOrdersController {
  constructor(private readonly selfOrdersService: SelfOrdersService) {}

  /* ════════════════════════════════════════
     GET /salon/orders/pending
     ════════════════════════════════════════ */
  @Get('pending')
  @ApiOperation({ summary: 'الطلبات المعلقة', description: 'جلب كل الطلبات الذاتية المعلقة' })
  @ApiResponse({ status: 200, description: 'قائمة الطلبات المعلقة' })
  async findPending(
    @Req() req: AuthenticatedRequest,
  ): Promise<Record<string, unknown>> {
    const data = await this.selfOrdersService.findPending(req.tenantDb!);
    return {
      success: true,
      data,
      message: 'تم جلب الطلبات المعلقة',
    };
  }

  /* ════════════════════════════════════════
     GET /salon/orders/:code
     ════════════════════════════════════════ */
  @Get(':code')
  @ApiOperation({ summary: 'تفاصيل الطلب', description: 'جلب طلب بالرمز' })
  @ApiParam({ name: 'code', description: 'رمز الطلب (مثل A001)' })
  @ApiResponse({ status: 200, description: 'بيانات الطلب' })
  @ApiResponse({ status: 404, description: 'الطلب غير موجود' })
  async findByCode(
    @Req() req: AuthenticatedRequest,
    @Param('code') code: string,
  ): Promise<Record<string, unknown>> {
    const data = await this.selfOrdersService.findByCode(req.tenantDb!, code);
    return {
      success: true,
      data,
      message: 'تم جلب بيانات الطلب',
    };
  }

  /* ════════════════════════════════════════
     POST /salon/orders/:code/claim
     ════════════════════════════════════════ */
  @Post(':code/claim')
  @ApiOperation({ summary: 'استلام الطلب', description: 'الكاشيرة تستلم طلب ذاتي' })
  @ApiParam({ name: 'code', description: 'رمز الطلب (مثل A001)' })
  @ApiResponse({ status: 200, description: 'تم استلام الطلب' })
  @ApiResponse({ status: 404, description: 'الطلب غير موجود' })
  @ApiResponse({ status: 409, description: 'الطلب مأخوذ من كاشيرة أخرى' })
  async claim(
    @Req() req: AuthenticatedRequest,
    @Param('code') code: string,
  ): Promise<Record<string, unknown>> {
    const tenantSlug = req.tenant?.slug ?? '';
    const data = await this.selfOrdersService.claim(
      req.tenantDb!,
      code,
      tenantSlug,
    );
    return {
      success: true,
      data,
      message: 'تم استلام الطلب بنجاح',
    };
  }
}
