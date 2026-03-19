import {
  Controller,
  Get,
  Put,
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
import { NotificationsService } from './notifications.service';
import { GetNotificationsDto, UpdateNotificationSettingsDto } from './notifications.dto';
import { TenantGuard } from '../../shared/guards';
import { AuthenticatedRequest, JwtPayload } from '../../shared/types';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';

@ApiTags('الإشعارات - Notifications')
@ApiBearerAuth()
@UseGuards(TenantGuard)
@Controller({ path: 'notifications', version: '1' })
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'قائمة إشعاراتي', description: 'عرض جميع الإشعارات الخاصة بالمستخدم الحالي' })
  @ApiResponse({ status: 200, description: 'تم جلب الإشعارات بنجاح' })
  async findAll(
    @Req() req: AuthenticatedRequest,
    @CurrentUser() user: JwtPayload,
    @Query() dto: GetNotificationsDto,
  ): Promise<Record<string, unknown>> {
    const result = await this.notificationsService.findAll(
      req.tenantDb!,
      user.sub,
      dto,
    );
    return {
      success: true,
      data: result.data,
      message: 'تم جلب الإشعارات بنجاح',
      meta: result.meta,
    };
  }

  @Put('read-all')
  @ApiOperation({ summary: 'تعليم الكل مقروء', description: 'تعليم جميع الإشعارات كمقروءة' })
  @ApiResponse({ status: 200, description: 'تم تعليم جميع الإشعارات كمقروءة' })
  async markAllAsRead(
    @Req() req: AuthenticatedRequest,
    @CurrentUser() user: JwtPayload,
  ): Promise<Record<string, unknown>> {
    const result = await this.notificationsService.markAllAsRead(
      req.tenantDb!,
      user.sub,
    );
    return {
      success: true,
      data: result,
      message: 'تم تعليم جميع الإشعارات كمقروءة',
    };
  }

  @Put(':id/read')
  @ApiOperation({ summary: 'تعليم كمقروء', description: 'تعليم إشعار محدد كمقروء' })
  @ApiParam({ name: 'id', description: 'معرّف الإشعار' })
  @ApiResponse({ status: 200, description: 'تم تعليم الإشعار كمقروء' })
  @ApiResponse({ status: 404, description: 'الإشعار غير موجود' })
  async markAsRead(
    @Req() req: AuthenticatedRequest,
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Record<string, unknown>> {
    const data = await this.notificationsService.markAsRead(
      req.tenantDb!,
      id,
      user.sub,
    );
    return {
      success: true,
      data,
      message: 'تم تعليم الإشعار كمقروء',
    };
  }

  @Get('settings')
  @ApiOperation({ summary: 'إعدادات الإشعارات', description: 'عرض إعدادات الإشعارات الحالية' })
  @ApiResponse({ status: 200, description: 'تم جلب إعدادات الإشعارات بنجاح' })
  async getSettings(
    @Req() req: AuthenticatedRequest,
  ): Promise<Record<string, unknown>> {
    const data = await this.notificationsService.getSettings(
      req.tenantDb!,
    );
    return {
      success: true,
      data,
      message: 'تم جلب إعدادات الإشعارات بنجاح',
    };
  }

  @Put('settings')
  @ApiOperation({ summary: 'تعديل إعدادات الإشعارات', description: 'تحديث إعدادات الإشعارات' })
  @ApiResponse({ status: 200, description: 'تم تحديث إعدادات الإشعارات بنجاح' })
  async updateSettings(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateNotificationSettingsDto,
  ): Promise<Record<string, unknown>> {
    const data = await this.notificationsService.updateSettings(
      req.tenantDb!,
      dto,
    );
    return {
      success: true,
      data,
      message: 'تم تحديث إعدادات الإشعارات بنجاح',
    };
  }
}
