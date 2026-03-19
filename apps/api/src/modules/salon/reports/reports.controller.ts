import {
  Controller,
  Get,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { ReportQueryDto } from './dto/report-query.dto';
import { TenantGuard } from '../../../shared/guards';
import { AuthenticatedRequest } from '../../../shared/types';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(TenantGuard)
@Controller({ path: 'reports', version: '1' })
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'ملخص لوحة التحكم' })
  @ApiResponse({ status: 200, description: 'تم جلب ملخص لوحة التحكم بنجاح' })
  async getDashboard(
    @Req() req: AuthenticatedRequest,
  ) {
    return this.reportsService.getDashboard(
      req.tenantDb!,
    );
  }

  @Get('revenue')
  @ApiOperation({ summary: 'تقرير الإيرادات' })
  @ApiResponse({ status: 200, description: 'تم جلب تقرير الإيرادات بنجاح' })
  async getRevenue(
    @Req() req: AuthenticatedRequest,
    @Query() query: ReportQueryDto,
  ) {
    return this.reportsService.getRevenue(
      req.tenantDb!,
      query,
    );
  }

  @Get('appointments')
  @ApiOperation({ summary: 'تقرير المواعيد' })
  @ApiResponse({ status: 200, description: 'تم جلب تقرير المواعيد بنجاح' })
  async getAppointments(
    @Req() req: AuthenticatedRequest,
    @Query() query: ReportQueryDto,
  ) {
    return this.reportsService.getAppointments(
      req.tenantDb!,
      query,
    );
  }

  @Get('clients')
  @ApiOperation({ summary: 'تقرير العملاء' })
  @ApiResponse({ status: 200, description: 'تم جلب تقرير العملاء بنجاح' })
  async getClients(
    @Req() req: AuthenticatedRequest,
    @Query() query: ReportQueryDto,
  ) {
    return this.reportsService.getClients(
      req.tenantDb!,
      query,
    );
  }

  @Get('employees')
  @ApiOperation({ summary: 'تقرير الموظفين' })
  @ApiResponse({ status: 200, description: 'تم جلب تقرير الموظفين بنجاح' })
  async getEmployees(
    @Req() req: AuthenticatedRequest,
    @Query() query: ReportQueryDto,
  ) {
    return this.reportsService.getEmployees(
      req.tenantDb!,
      query,
    );
  }

  @Get('services')
  @ApiOperation({ summary: 'تقرير الخدمات' })
  @ApiResponse({ status: 200, description: 'تم جلب تقرير الخدمات بنجاح' })
  async getServices(
    @Req() req: AuthenticatedRequest,
    @Query() query: ReportQueryDto,
  ) {
    return this.reportsService.getServices(
      req.tenantDb!,
      query,
    );
  }

  @Get('expenses')
  @ApiOperation({ summary: 'تقرير المصروفات' })
  @ApiResponse({ status: 200, description: 'تم جلب تقرير المصروفات بنجاح' })
  async getExpenses(
    @Req() req: AuthenticatedRequest,
    @Query() query: ReportQueryDto,
  ) {
    return this.reportsService.getExpenses(
      req.tenantDb!,
      query,
    );
  }
}
