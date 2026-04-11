import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { TenantPrismaClient } from '../../../shared/types';
import { ReportsService } from './reports.service';
import { ReportQueryDto } from './dto/report-query.dto';

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
  constructor(private readonly reportsService: ReportsService) {}

  /* ════════════════════════════════════════
     REVENUE — PDF
     ════════════════════════════════════════ */
  async exportRevenuePdf(
    db: TenantPrismaClient,
    query: ReportQueryDto,
    salonName: string,
  ): Promise<Buffer> {
    const data = await this.reportsService.getRevenue(db, query);

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    // Header
    doc.fontSize(20).fillColor('#8B5CF6').text(salonName, { align: 'center' }).moveDown(0.3);
    doc.fontSize(14).fillColor('#333').text('تقرير الإيرادات', { align: 'center' }).moveDown(0.3);
    doc.fontSize(10).fillColor('#666').text(`${query.dateFrom} — ${query.dateTo}`, { align: 'center' }).moveDown(1);

    // Summary
    doc.fontSize(12).fillColor('#333')
      .text(`إجمالي الإيرادات: ${data.totalRevenue.toFixed(2)} ر.س`, { align: 'right' })
      .text(`عدد الفواتير: ${data.totalCount}`, { align: 'right' })
      .moveDown(1);

    // Table
    doc.fontSize(10).fillColor('#555').text('الفترة', 350, doc.y, { width: 100, align: 'right' });
    doc.text('عدد', 250, doc.y - 14, { width: 80, align: 'right' });
    doc.text('إيراد (ر.س)', 100, doc.y - 14, { width: 130, align: 'right' });
    doc.moveDown(0.5);

    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#ddd');
    doc.moveDown(0.3);

    for (const item of data.items) {
      doc.fontSize(10).fillColor('#333')
        .text(item.period, 350, doc.y, { width: 100, align: 'right' })
        .text(String(item.count), 250, doc.y - 14, { width: 80, align: 'right' })
        .text(item.revenue.toFixed(2), 100, doc.y - 14, { width: 130, align: 'right' });
      doc.moveDown(0.3);
    }

    doc.moveDown(1);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#8B5CF6');
    doc.moveDown(0.3);
    doc.fontSize(11).fillColor('#8B5CF6')
      .text(`الإجمالي: ${data.totalRevenue.toFixed(2)} ر.س`, { align: 'right' });

    // Footer
    doc.moveDown(2);
    doc.fontSize(8).fillColor('#999')
      .text(`تم التصدير بتاريخ: ${new Date().toLocaleDateString('ar-SA')} — SERVIX`, { align: 'center' });

    doc.end();

    return new Promise((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });
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

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    doc.fontSize(20).fillColor('#8B5CF6').text(salonName, { align: 'center' }).moveDown(0.3);
    doc.fontSize(14).fillColor('#333').text('تقرير أداء الموظفين', { align: 'center' }).moveDown(0.3);
    doc.fontSize(10).fillColor('#666').text(`${query.dateFrom} — ${query.dateTo}`, { align: 'center' }).moveDown(1);

    for (const item of data) {
      const emp = item.employee as { fullName?: string; role?: string };
      doc.fontSize(11).fillColor('#333')
        .text(`${emp.fullName || '—'} (${emp.role || '—'})`, { align: 'right' })
        .fontSize(10).fillColor('#666')
        .text(`   المواعيد: ${item.appointmentsCount} | الإيراد: ${item.revenue.toFixed(2)} ر.س`, { align: 'right' })
        .moveDown(0.5);
    }

    doc.moveDown(1);
    doc.fontSize(8).fillColor('#999')
      .text(`تم التصدير بتاريخ: ${new Date().toLocaleDateString('ar-SA')} — SERVIX`, { align: 'center' });

    doc.end();

    return new Promise((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });
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
