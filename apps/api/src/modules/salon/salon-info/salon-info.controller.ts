import { Controller, Get, Put, Body, Req, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { TenantGuard } from '../../../shared/guards';
import { SalonInfoService } from './salon-info.service';
import { UpdateSalonDto } from './dto/update-salon.dto';
import { UpdateBrandingDto } from './dto/update-branding.dto';
import { UpdateWorkingHoursDto } from './dto/update-working-hours.dto';
import { AuthenticatedRequest } from '../../../shared/types';

@ApiTags('Salon Info')
@ApiBearerAuth()
@UseGuards(TenantGuard)
@Controller({ path: 'salon', version: '1' })
export class SalonInfoController {
  constructor(private readonly salonInfoService: SalonInfoService) {}

  @Get()
  @ApiOperation({ summary: 'الحصول على معلومات الصالون' })
  @ApiResponse({ status: 200, description: 'تم جلب معلومات الصالون بنجاح' })
  async get(
    @Req() req: AuthenticatedRequest,
  ): Promise<Record<string, unknown>> {
    return this.salonInfoService.get(req.tenantDb!);
  }

  @Put()
  @ApiOperation({ summary: 'تحديث معلومات الصالون' })
  @ApiResponse({ status: 200, description: 'تم تحديث معلومات الصالون بنجاح' })
  @ApiResponse({ status: 400, description: 'بيانات غير صالحة' })
  async update(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateSalonDto,
  ): Promise<Record<string, unknown>> {
    return this.salonInfoService.update(
      req.tenantDb!,
      dto,
    );
  }

  @Put('branding')
  @ApiOperation({ summary: 'تحديث الهوية البصرية' })
  @ApiResponse({ status: 200, description: 'تم تحديث الهوية البصرية بنجاح' })
  @ApiResponse({ status: 400, description: 'بيانات غير صالحة' })
  async updateBranding(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateBrandingDto,
  ) {
    return this.salonInfoService.updateBranding(
      req.tenantDb!,
      dto,
    );
  }

  @Put('working-hours')
  @ApiOperation({ summary: 'تحديث ساعات العمل' })
  @ApiResponse({ status: 200, description: 'تم تحديث ساعات العمل بنجاح' })
  @ApiResponse({ status: 400, description: 'بيانات غير صالحة' })
  async updateWorkingHours(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateWorkingHoursDto,
  ) {
    return this.salonInfoService.updateWorkingHours(
      req.tenantDb!,
      dto,
    );
  }
}
