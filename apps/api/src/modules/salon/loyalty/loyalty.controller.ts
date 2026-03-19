import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Param,
  Query,
  Req,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { LoyaltyService } from './loyalty.service';
import { AdjustPointsDto } from './dto/adjust-points.dto';
import { UpdateLoyaltySettingsDto } from './dto/update-settings.dto';
import { QueryTransactionsDto } from './dto/query-transactions.dto';
import { TenantGuard } from '../../../shared/guards';
import { AuthenticatedRequest } from '../../../shared/types';

@ApiTags('الولاء - Loyalty')
@ApiBearerAuth()
@UseGuards(TenantGuard)
@Controller({ path: 'loyalty', version: '1' })
export class LoyaltyController {
  constructor(private readonly loyaltyService: LoyaltyService) {}

  @Get('settings')
  @ApiOperation({ summary: 'إعدادات الولاء', description: 'عرض إعدادات نظام الولاء' })
  @ApiResponse({ status: 200, description: 'تم جلب إعدادات الولاء بنجاح' })
  async getSettings(
    @Req() req: AuthenticatedRequest,
  ): Promise<Record<string, unknown>> {
    const data = await this.loyaltyService.getSettings(
      req.tenantDb!,
    );
    return {
      success: true,
      data,
      message: 'تم جلب إعدادات الولاء بنجاح',
    };
  }

  @Put('settings')
  @ApiOperation({ summary: 'تحديث إعدادات الولاء', description: 'تعديل إعدادات نظام الولاء' })
  @ApiResponse({ status: 200, description: 'تم تحديث إعدادات الولاء بنجاح' })
  async updateSettings(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateLoyaltySettingsDto,
  ): Promise<Record<string, unknown>> {
    const data = await this.loyaltyService.updateSettings(
      req.tenantDb!,
      dto,
    );
    return {
      success: true,
      data,
      message: 'تم تحديث إعدادات الولاء بنجاح',
    };
  }

  @Get('clients/:id')
  @ApiOperation({ summary: 'نقاط ولاء العميل', description: 'عرض رصيد ومعاملات ولاء العميل' })
  @ApiParam({ name: 'id', description: 'معرّف العميل' })
  @ApiResponse({ status: 200, description: 'تم جلب نقاط الولاء بنجاح' })
  @ApiResponse({ status: 404, description: 'العميل غير موجود' })
  async getClientLoyalty(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Record<string, unknown>> {
    const data = await this.loyaltyService.getClientLoyalty(
      req.tenantDb!,
      id,
    );
    return {
      success: true,
      data,
      message: 'تم جلب نقاط الولاء بنجاح',
    };
  }

  @Post('clients/:id/adjust')
  @ApiOperation({ summary: 'تعديل النقاط', description: 'تعديل يدوي لنقاط ولاء العميل' })
  @ApiParam({ name: 'id', description: 'معرّف العميل' })
  @ApiResponse({ status: 201, description: 'تم تعديل النقاط بنجاح' })
  @ApiResponse({ status: 400, description: 'رصيد النقاط غير كافٍ' })
  @ApiResponse({ status: 404, description: 'العميل غير موجود' })
  async adjustPoints(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdjustPointsDto,
  ): Promise<Record<string, unknown>> {
    const data = await this.loyaltyService.adjustPoints(
      req.tenantDb!,
      id,
      dto,
    );
    return {
      success: true,
      data,
      message: 'تم تعديل النقاط بنجاح',
    };
  }

  @Get('transactions')
  @ApiOperation({ summary: 'سجل معاملات الولاء', description: 'عرض جميع معاملات الولاء مع التصفية' })
  @ApiResponse({ status: 200, description: 'تم جلب سجل المعاملات بنجاح' })
  async getTransactions(
    @Req() req: AuthenticatedRequest,
    @Query() query: QueryTransactionsDto,
  ): Promise<Record<string, unknown>> {
    const result = await this.loyaltyService.getTransactions(
      req.tenantDb!,
      query,
    );
    return {
      success: true,
      data: result.data,
      message: 'تم جلب سجل المعاملات بنجاح',
      meta: result.meta,
    };
  }
}
