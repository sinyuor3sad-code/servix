import {
  Controller,
  Get,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { ReportsService } from './reports.service';
import { ReportExportService } from './report-export.service';
import { ReportQueryDto } from './dto/report-query.dto';
import { TenantGuard } from '../../../shared/guards';
import { AuthenticatedRequest } from '../../../shared/types';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(TenantGuard)
@Controller({ path: 'reports', version: '1' })
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly exportService: ReportExportService,
  ) {}

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

  /* ════════════════════════════════════════
     EXPORT ENDPOINTS — PDF / CSV
     ════════════════════════════════════════ */

  @Get('revenue/export/pdf')
  @ApiOperation({ summary: 'تصدير تقرير الإيرادات PDF' })
  async exportRevenuePdf(
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
    @Query() query: ReportQueryDto,
  ) {
    const salonInfo = await req.tenantDb!.salonInfo.findFirst();
    const buffer = await this.exportService.exportRevenuePdf(
      req.tenantDb!,
      query,
      salonInfo?.nameAr || 'SERVIX',
    );
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="revenue-report-${query.dateFrom}.pdf"`,
    });
    res.send(buffer);
  }

  @Get('revenue/export/csv')
  @ApiOperation({ summary: 'تصدير تقرير الإيرادات Excel/CSV' })
  async exportRevenueCsv(
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
    @Query() query: ReportQueryDto,
  ) {
    const buffer = await this.exportService.exportRevenueCsv(req.tenantDb!, query);
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="revenue-report-${query.dateFrom}.csv"`,
    });
    res.send(buffer);
  }

  @Get('employees/export/pdf')
  @ApiOperation({ summary: 'تصدير تقرير الموظفين PDF' })
  async exportEmployeesPdf(
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
    @Query() query: ReportQueryDto,
  ) {
    const salonInfo = await req.tenantDb!.salonInfo.findFirst();
    const buffer = await this.exportService.exportEmployeesPdf(
      req.tenantDb!,
      query,
      salonInfo?.nameAr || 'SERVIX',
    );
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="employees-report-${query.dateFrom}.pdf"`,
    });
    res.send(buffer);
  }

  @Get('employees/export/csv')
  @ApiOperation({ summary: 'تصدير تقرير الموظفين Excel/CSV' })
  async exportEmployeesCsv(
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
    @Query() query: ReportQueryDto,
  ) {
    const buffer = await this.exportService.exportEmployeesCsv(req.tenantDb!, query);
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="employees-report-${query.dateFrom}.csv"`,
    });
    res.send(buffer);
  }

  @Get('services/export/csv')
  @ApiOperation({ summary: 'تصدير تقرير الخدمات Excel/CSV' })
  async exportServicesCsv(
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
    @Query() query: ReportQueryDto,
  ) {
    const buffer = await this.exportService.exportServicesCsv(req.tenantDb!, query);
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="services-report-${query.dateFrom}.csv"`,
    });
    res.send(buffer);
  }

  @Get('expenses/export/csv')
  @ApiOperation({ summary: 'تصدير تقرير المصروفات Excel/CSV' })
  async exportExpensesCsv(
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
    @Query() query: ReportQueryDto,
  ) {
    const buffer = await this.exportService.exportExpensesCsv(req.tenantDb!, query);
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="expenses-report-${query.dateFrom}.csv"`,
    });
    res.send(buffer);
  }

  @Get('clients/export/csv')
  @ApiOperation({ summary: 'تصدير تقرير العملاء Excel/CSV' })
  async exportClientsCsv(
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
    @Query() query: ReportQueryDto,
  ) {
    const buffer = await this.exportService.exportClientsCsv(req.tenantDb!, query);
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="clients-report-${query.dateFrom}.csv"`,
    });
    res.send(buffer);
  }
}

