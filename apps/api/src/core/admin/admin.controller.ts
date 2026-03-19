import {
  Controller,
  Get,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { RolesGuard } from '../../shared/guards';
import { Roles, CurrentUser } from '../../shared/decorators';
import {
  GetTenantsDto,
  UpdateTenantStatusDto,
  GetSubscriptionsDto,
  GetInvoicesDto,
  GetAuditLogsDto,
} from './admin.dto';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles('super_admin')
@Controller({ path: 'admin', version: '1' })
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  @ApiOperation({ summary: 'إحصائيات شاملة للمنصة' })
  @ApiResponse({ status: 200, description: 'تم جلب الإحصائيات بنجاح' })
  async getStats() {
    return this.adminService.getStats();
  }

  @Get('tenants')
  @ApiOperation({ summary: 'عرض جميع المنشآت مع التصفية والبحث' })
  @ApiResponse({ status: 200, description: 'قائمة المنشآت' })
  async getTenants(
    @Query() dto: GetTenantsDto,
  ) {
    return this.adminService.getTenants(dto);
  }

  @Get('tenants/:id')
  @ApiOperation({ summary: 'عرض تفاصيل منشأة محددة' })
  @ApiParam({ name: 'id', description: 'معرف المنشأة (UUID)' })
  @ApiResponse({ status: 200, description: 'تفاصيل المنشأة مع المستخدمين والاشتراكات' })
  @ApiResponse({ status: 404, description: 'المنشأة غير موجودة' })
  async getTenantById(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.adminService.getTenantById(id);
  }

  @Put('tenants/:id/status')
  @ApiOperation({ summary: 'تعليق أو تفعيل منشأة' })
  @ApiParam({ name: 'id', description: 'معرف المنشأة (UUID)' })
  @ApiResponse({ status: 200, description: 'تم تحديث حالة المنشأة بنجاح' })
  @ApiResponse({ status: 400, description: 'المنشأة في نفس الحالة بالفعل' })
  @ApiResponse({ status: 404, description: 'المنشأة غير موجودة' })
  async updateTenantStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTenantStatusDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.adminService.updateTenantStatus(id, dto.status, userId);
  }

  @Get('subscriptions')
  @ApiOperation({ summary: 'عرض جميع الاشتراكات' })
  @ApiResponse({ status: 200, description: 'قائمة الاشتراكات مع معلومات المنشأة والباقة' })
  async getSubscriptions(
    @Query() dto: GetSubscriptionsDto,
  ) {
    return this.adminService.getSubscriptions(dto);
  }

  @Get('invoices')
  @ApiOperation({ summary: 'عرض فواتير المنصة' })
  @ApiResponse({ status: 200, description: 'قائمة الفواتير مع معلومات المنشأة' })
  async getInvoices(
    @Query() dto: GetInvoicesDto,
  ) {
    return this.adminService.getInvoices(dto);
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'عرض سجل العمليات' })
  @ApiResponse({ status: 200, description: 'سجل العمليات مع معلومات المستخدم' })
  async getAuditLogs(
    @Query() dto: GetAuditLogsDto,
  ) {
    return this.adminService.getAuditLogs(dto);
  }
}
