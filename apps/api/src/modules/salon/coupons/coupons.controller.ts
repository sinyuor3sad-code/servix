import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Req,
  Query,
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
import { CouponsService } from './coupons.service';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';
import { ValidateCouponDto } from './dto/validate-coupon.dto';
import { TenantGuard } from '../../../shared/guards';
import { AuthenticatedRequest } from '../../../shared/types';

@ApiTags('الكوبونات - Coupons')
@ApiBearerAuth()
@UseGuards(TenantGuard)
@Controller({ path: 'coupons', version: '1' })
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Get()
  @ApiOperation({ summary: 'قائمة الكوبونات', description: 'عرض جميع الكوبونات' })
  @ApiResponse({ status: 200, description: 'تم جلب قائمة الكوبونات بنجاح' })
  async findAll(
    @Req() req: AuthenticatedRequest,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ): Promise<Record<string, unknown>> {
    const result = await this.couponsService.findAll(
      req.tenantDb!,
      { page, limit },
    );
    return {
      success: true,
      data: result,
      message: 'تم جلب قائمة الكوبونات بنجاح',
    };
  }

  @Post()
  @ApiOperation({ summary: 'إنشاء كوبون', description: 'إنشاء كوبون جديد' })
  @ApiResponse({ status: 201, description: 'تم إنشاء الكوبون بنجاح' })
  @ApiResponse({ status: 400, description: 'بيانات غير صالحة' })
  @ApiResponse({ status: 409, description: 'كود الكوبون مستخدم بالفعل' })
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateCouponDto,
  ): Promise<Record<string, unknown>> {
    const data = await this.couponsService.create(
      req.tenantDb!,
      dto,
    );
    return {
      success: true,
      data,
      message: 'تم إنشاء الكوبون بنجاح',
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'تفاصيل الكوبون', description: 'عرض بيانات كوبون محدد' })
  @ApiParam({ name: 'id', description: 'معرّف الكوبون' })
  @ApiResponse({ status: 200, description: 'تم جلب بيانات الكوبون بنجاح' })
  @ApiResponse({ status: 404, description: 'الكوبون غير موجود' })
  async findOne(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Record<string, unknown>> {
    const data = await this.couponsService.findOne(
      req.tenantDb!,
      id,
    );
    return {
      success: true,
      data,
      message: 'تم جلب بيانات الكوبون بنجاح',
    };
  }

  @Put(':id')
  @ApiOperation({ summary: 'تحديث الكوبون', description: 'تعديل بيانات كوبون محدد' })
  @ApiParam({ name: 'id', description: 'معرّف الكوبون' })
  @ApiResponse({ status: 200, description: 'تم تحديث الكوبون بنجاح' })
  @ApiResponse({ status: 404, description: 'الكوبون غير موجود' })
  @ApiResponse({ status: 409, description: 'كود الكوبون مستخدم بالفعل' })
  async update(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCouponDto,
  ): Promise<Record<string, unknown>> {
    const data = await this.couponsService.update(
      req.tenantDb!,
      id,
      dto,
    );
    return {
      success: true,
      data,
      message: 'تم تحديث الكوبون بنجاح',
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'حذف الكوبون', description: 'حذف كوبون محدد' })
  @ApiParam({ name: 'id', description: 'معرّف الكوبون' })
  @ApiResponse({ status: 200, description: 'تم حذف الكوبون بنجاح' })
  @ApiResponse({ status: 404, description: 'الكوبون غير موجود' })
  async remove(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Record<string, unknown>> {
    const data = await this.couponsService.remove(
      req.tenantDb!,
      id,
    );
    return {
      success: true,
      data,
      message: 'تم حذف الكوبون بنجاح',
    };
  }

  @Post('validate')
  @ApiOperation({ summary: 'التحقق من كوبون', description: 'التحقق من صلاحية كود كوبون' })
  @ApiResponse({ status: 200, description: 'تم التحقق من الكوبون' })
  async validate(
    @Req() req: AuthenticatedRequest,
    @Body() dto: ValidateCouponDto,
  ): Promise<Record<string, unknown>> {
    const result = await this.couponsService.validate(
      req.tenantDb!,
      dto,
    );
    return {
      success: true,
      data: result,
      message: result.message,
    };
  }
}
