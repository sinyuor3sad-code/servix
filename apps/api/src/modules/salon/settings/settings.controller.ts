import {
  Controller,
  Get,
  Put,
  Body,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { UpdateSettingDto } from './dto/update-setting.dto';
import { TenantGuard } from '../../../shared/guards';
import { RequirePermission } from '../../../shared/decorators';
import { AuthenticatedRequest } from '../../../shared/types';

@ApiTags('Settings')
@ApiBearerAuth()
@UseGuards(TenantGuard)
@Controller({ path: 'settings', version: '1' })
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @RequirePermission('settings.view')
  @ApiOperation({ summary: 'عرض جميع الإعدادات' })
  @ApiResponse({ status: 200, description: 'تم جلب الإعدادات بنجاح' })
  async getAll(
    @Req() req: AuthenticatedRequest,
  ): Promise<Record<string, string>> {
    return this.settingsService.getAll(
      req.tenantDb!,
      req.tenant?.id,
    );
  }

  @Put()
  @RequirePermission('settings.update')
  @ApiOperation({ summary: 'تحديث مجموعة إعدادات' })
  @ApiResponse({ status: 200, description: 'تم تحديث الإعدادات بنجاح' })
  async updateBatch(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateSettingsDto,
  ): Promise<Record<string, string>> {
    return this.settingsService.updateBatch(
      req.tenantDb!,
      dto,
      req.user.sub,
      req.tenant?.id,
    );
  }

  @Get(':key')
  @RequirePermission('settings.view')
  @ApiOperation({ summary: 'عرض إعداد محدد' })
  @ApiResponse({ status: 200, description: 'تم جلب الإعداد بنجاح' })
  @ApiResponse({ status: 404, description: 'الإعداد غير موجود' })
  async getByKey(
    @Req() req: AuthenticatedRequest,
    @Param('key') key: string,
  ): Promise<Record<string, unknown>> {
    return this.settingsService.getByKey(
      req.tenantDb!,
      key,
    );
  }

  @Put(':key')
  @RequirePermission('settings.update')
  @ApiOperation({ summary: 'تحديث إعداد محدد' })
  @ApiResponse({ status: 200, description: 'تم تحديث الإعداد بنجاح' })
  async updateByKey(
    @Req() req: AuthenticatedRequest,
    @Param('key') key: string,
    @Body() dto: UpdateSettingDto,
  ): Promise<Record<string, unknown>> {
    return this.settingsService.updateByKey(
      req.tenantDb!,
      key,
      dto.value,
      req.user.sub,
      req.tenant?.id,
    );
  }
}
