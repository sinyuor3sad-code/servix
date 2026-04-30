import { Injectable } from '@nestjs/common';
import { TenantPrismaClient } from '../../../shared/types';
import { ReportsService } from './reports.service';
import { ReportQueryDto } from './dto/report-query.dto';
import { PdfService } from '../../../shared/pdf/pdf.service';
import { buildReportHtml } from '../../../shared/pdf/templates/report.template';

// CSV generation helper (Excel-compatible with UTF-8 BOM)
function toCsv(headers: string[], rows: (string | number)[][]): Buffer {
  const BOM = '\uFEFF'; // UTF-8 BOM for Excel Arabic support
  const headerLine = headers.join(',');
  const dataLines = rows.map((row) =>
    row.map((cell) => {
      const str = String(cell);
      // Escape commas and quotes
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(','),
  );
  return Buffer.from(BOM + [headerLine, ...dataLines].join('\r\n'), 'utf-8');
}

@Injectable()
export class ReportExportService {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly pdfService: PdfService,
  ) {}

  /* ════════════════════════════════════════
     REVENUE — PDF
     ════════════════════════════════════════ */
  async exportRevenuePdf(
    db: TenantPrismaClient,
    query: ReportQueryDto,
    salonName: string,
  ): Promise<Buffer> {
    const data = await this.reportsService.getRevenue(db, query);

    const html = buildReportHtml({
      salonName,
      title: 'تقرير الإيرادات',
      dateRange: `${query.dateFrom} — ${query.dateTo}`,
      summary: [
        { label: 'إجمالي الإيرادات', value: `${data.totalRevenue.toFixed(2)} ر.س` },
        { label: 'عدد الفواتير', value: String(data.totalCount) },
      ],
      table: {
        headers: ['الفترة', 'عدد الفواتير', 'الإيراد (ر.س)'],
        rows: data.items.map((item) => [item.period, item.count, item.revenue.toFixed(2)]),
        footer: ['الإجمالي', data.totalCount, data.totalRevenue.toFixed(2)],
      },
    });

    return this.pdfService.htmlToPdf(html);
  }

  /* ════════════════════════════════════════
     REVENUE — Excel (CSV with UTF-8 BOM)
     ════════════════════════════════════════ */
  async exportRevenueCsv(
    db: TenantPrismaClient,
    query: ReportQueryDto,
  ): Promise<Buffer> {
    const data = await this.reportsService.getRevenue(db, query);
    const headers = ['الفترة', 'عدد الفواتير', 'الإيراد (ر.س)'];
    const rows = data.items.map((item) => [
      item.period,
      item.count,
      item.revenue.toFixed(2),
    ]);
    // Total row
    rows.push(['الإجمالي', data.totalCount, data.totalRevenue.toFixed(2)]);
    return toCsv(headers, rows);
  }

  /* ════════════════════════════════════════
     EMPLOYEES — PDF
     ════════════════════════════════════════ */
  async exportEmployeesPdf(
    db: TenantPrismaClient,
    query: ReportQueryDto,
    salonName: string,
  ): Promise<Buffer> {
    const data = await this.reportsService.getEmployees(db, query);

    const html = buildReportHtml({
      salonName,
      title: 'تقرير أداء الموظفين',
      dateRange: `${query.dateFrom} — ${query.dateTo}`,
      lines: data.map((item) => {
        const emp = item.employee as { fullName?: string; role?: string };
        return {
          primary: `${emp.fullName || '—'} (${emp.role || '—'})`,
          secondary: `المواعيد: ${item.appointmentsCount} • الإيراد: ${item.revenue.toFixed(2)} ر.س`,
        };
      }),
    });

    return this.pdfService.htmlToPdf(html);
  }

  /* ════════════════════════════════════════
     EMPLOYEES — CSV
     ════════════════════════════════════════ */
  async exportEmployeesCsv(
    db: TenantPrismaClient,
    query: ReportQueryDto,
  ): Promise<Buffer> {
    const data = await this.reportsService.getEmployees(db, query);
    const headers = ['الموظف', 'الدور', 'عدد المواعيد', 'الإيراد (ر.س)'];
    const rows = data.map((item) => {
      const emp = item.employee as { fullName?: string; role?: string };
      return [emp.fullName || '—', emp.role || '—', item.appointmentsCount, item.revenue.toFixed(2)];
    });
    return toCsv(headers, rows);
  }

  /* ════════════════════════════════════════
     SERVICES — CSV
     ════════════════════════════════════════ */
  async exportServicesCsv(
    db: TenantPrismaClient,
    query: ReportQueryDto,
  ): Promise<Buffer> {
    const data = await this.reportsService.getServices(db, query);
    const headers = ['الخدمة', 'عدد الحجوزات', 'الإيراد (ر.س)'];
    const rows = data.map((item) => {
      const svc = item.service as { nameAr?: string };
      return [svc.nameAr || '—', item.bookingsCount, item.revenue.toFixed(2)];
    });
    return toCsv(headers, rows);
  }

  /* ════════════════════════════════════════
     EXPENSES — CSV
     ════════════════════════════════════════ */
  async exportExpensesCsv(
    db: TenantPrismaClient,
    query: ReportQueryDto,
  ): Promise<Buffer> {
    const data = await this.reportsService.getExpenses(db, query);
    const headers = ['الفئة', 'عدد العمليات', 'الإجمالي (ر.س)'];
    const rows = data.items.map((item) => [item.category, item.count, item.total.toFixed(2)]);
    rows.push(['الإجمالي', '', data.grandTotal.toFixed(2)]);
    return toCsv(headers, rows);
  }

  /* ════════════════════════════════════════
     CLIENTS — CSV
     ════════════════════════════════════════ */
  async exportClientsCsv(
    db: TenantPrismaClient,
    query: ReportQueryDto,
  ): Promise<Buffer> {
    const data = await this.reportsService.getClients(db, query);
    const headers = ['الاسم', 'الجوال', 'عدد الزيارات', 'إجمالي الإنفاق (ر.س)'];
    const rows = data.topClients.map((c: Record<string, unknown>) => [
      String(c.fullName || '—'),
      String(c.phone || '—'),
      Number(c.totalVisits || 0),
      Number(c.totalSpent || 0).toFixed(2),
    ]);
    return toCsv(headers, rows);
  }
}
