import { Injectable } from '@nestjs/common';
import { TenantPrismaClient } from '../../../shared/types';
import { ReportQueryDto } from './dto/report-query.dto';

interface DashboardResult {
  todayAppointments: number;
  todayRevenue: number;
  monthRevenue: number;
  totalClients: number;
  totalEmployees: number;
  monthlyRevenue: number;
  monthlyAppointments: number;
  recentAppointments: Record<string, unknown>[];
  upcomingAppointments: Record<string, unknown>[];
}

interface RevenueItem {
  period: string;
  revenue: number;
  count: number;
}

interface RevenueResult {
  items: RevenueItem[];
  totalRevenue: number;
  totalCount: number;
}

interface AppointmentsResult {
  total: number;
  byStatus: Record<string, number>;
  bySource: Record<string, number>;
}

interface ClientsResult {
  newClients: number;
  returningClients: number;
  topClients: Record<string, unknown>[];
}

interface EmployeeReportItem {
  employee: Record<string, unknown>;
  appointmentsCount: number;
  revenue: number;
}

interface ServiceReportItem {
  service: Record<string, unknown>;
  bookingsCount: number;
  revenue: number;
}

interface ExpenseReportItem {
  category: string;
  total: number;
  count: number;
}

interface ExpensesResult {
  items: ExpenseReportItem[];
  grandTotal: number;
}

@Injectable()
export class ReportsService {
  async getDashboard(
    db: TenantPrismaClient,
  ): Promise<DashboardResult> {
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const [
      todayAppointments,
      todayInvoices,
      monthInvoices,
      totalClients,
      totalEmployees,
      monthlyAppointments,
      upcomingAppointments,
      recentAppointments,
    ] = await Promise.all([
      db.appointment.count({
        where: { date: { gte: todayStart, lt: todayEnd } },
      }),
      db.invoice.findMany({
        where: { status: 'paid', paidAt: { gte: todayStart, lt: todayEnd } },
        select: { total: true },
      }),
      db.invoice.findMany({
        where: { status: 'paid', paidAt: { gte: monthStart, lt: todayEnd } },
        select: { total: true },
      }),
      db.client.count({ where: { isActive: true, deletedAt: null } }),
      db.employee.count({ where: { isActive: true } }),
      db.appointment.count({
        where: { date: { gte: monthStart, lt: todayEnd } },
      }),
      db.appointment.findMany({
        where: {
          date: { gte: todayStart },
          status: { in: ['pending', 'confirmed'] },
        },
        include: {
          client: { select: { id: true, fullName: true } },
          employee: { select: { id: true, fullName: true } },
          appointmentServices: {
            include: {
              service: { select: { id: true, nameAr: true, nameEn: true } },
            },
          },
        },
        orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
        take: 10,
      }),
      db.appointment.findMany({
        where: {
          date: { lte: todayStart },
          status: 'completed',
        },
        include: {
          client: { select: { id: true, fullName: true } },
          employee: { select: { id: true, fullName: true } },
          appointmentServices: {
            include: {
              service: { select: { id: true, nameAr: true, nameEn: true } },
            },
          },
        },
        orderBy: [{ date: 'desc' }, { startTime: 'desc' }],
        take: 10,
      }),
    ]);

    const todayRevenue = todayInvoices.reduce(
      (sum, inv) => sum + Number(inv.total),
      0,
    );
    const monthRevenue = monthInvoices.reduce(
      (sum, inv) => sum + Number(inv.total),
      0,
    );

    return {
      todayAppointments,
      todayRevenue,
      monthRevenue,
      totalClients,
      totalEmployees,
      monthlyRevenue: monthRevenue,
      monthlyAppointments,
      recentAppointments: recentAppointments as unknown as Record<string, unknown>[],
      upcomingAppointments: upcomingAppointments as unknown as Record<string, unknown>[],
    };
  }

  async getRevenue(
    db: TenantPrismaClient,
    query: ReportQueryDto,
  ): Promise<RevenueResult> {
    const dateFrom = new Date(query.dateFrom);
    const dateTo = new Date(query.dateTo);

    const invoices = await db.invoice.findMany({
      where: {
        status: 'paid',
        paidAt: { gte: dateFrom, lte: dateTo },
      },
      select: { total: true, paidAt: true },
      orderBy: { paidAt: 'asc' },
    });

    const grouped = new Map<string, { revenue: number; count: number }>();

    for (const invoice of invoices) {
      if (!invoice.paidAt) continue;
      const key = this.getGroupKey(invoice.paidAt, query.groupBy);
      const existing = grouped.get(key) || { revenue: 0, count: 0 };
      existing.revenue += Number(invoice.total);
      existing.count += 1;
      grouped.set(key, existing);
    }

    const items: RevenueItem[] = Array.from(grouped.entries()).map(
      ([period, data]) => ({
        period,
        revenue: data.revenue,
        count: data.count,
      }),
    );

    return {
      items,
      totalRevenue: items.reduce((sum, i) => sum + i.revenue, 0),
      totalCount: items.reduce((sum, i) => sum + i.count, 0),
    };
  }

  async getAppointments(
    db: TenantPrismaClient,
    query: ReportQueryDto,
  ): Promise<AppointmentsResult> {
    const dateFrom = new Date(query.dateFrom);
    const dateTo = new Date(query.dateTo);

    const appointments = await db.appointment.findMany({
      where: { date: { gte: dateFrom, lte: dateTo } },
      select: { status: true, source: true },
    });

    const byStatus: Record<string, number> = {};
    const bySource: Record<string, number> = {};

    for (const appt of appointments) {
      byStatus[appt.status] = (byStatus[appt.status] || 0) + 1;
      bySource[appt.source] = (bySource[appt.source] || 0) + 1;
    }

    return {
      total: appointments.length,
      byStatus,
      bySource,
    };
  }

  async getClients(
    db: TenantPrismaClient,
    query: ReportQueryDto,
  ): Promise<ClientsResult> {
    const dateFrom = new Date(query.dateFrom);
    const dateTo = new Date(query.dateTo);

    const [newClients, topClients] = await Promise.all([
      db.client.count({
        where: {
          createdAt: { gte: dateFrom, lte: dateTo },
          deletedAt: null,
        },
      }),
      db.client.findMany({
        where: { deletedAt: null, isActive: true },
        select: {
          id: true,
          fullName: true,
          phone: true,
          totalVisits: true,
          totalSpent: true,
        },
        orderBy: { totalSpent: 'desc' },
        take: 10,
      }),
    ]);

    const returningClients = await db.client.count({
      where: {
        deletedAt: null,
        totalVisits: { gt: 1 },
        lastVisitAt: { gte: dateFrom, lte: dateTo },
      },
    });

    return {
      newClients,
      returningClients,
      topClients: topClients.map((c) => ({
        ...c,
        totalSpent: Number(c.totalSpent),
      })),
    };
  }

  async getEmployees(
    db: TenantPrismaClient,
    query: ReportQueryDto,
  ): Promise<EmployeeReportItem[]> {
    const dateFrom = new Date(query.dateFrom);
    const dateTo = new Date(query.dateTo);

    const employees = await db.employee.findMany({
      where: { isActive: true },
      select: { id: true, fullName: true, role: true },
    });

    const result: EmployeeReportItem[] = [];

    for (const employee of employees) {
      const [appointmentsCount, invoiceItems] = await Promise.all([
        db.appointment.count({
          where: {
            employeeId: employee.id,
            date: { gte: dateFrom, lte: dateTo },
            status: { in: ['completed', 'in_progress'] },
          },
        }),
        db.appointmentService.findMany({
          where: {
            employeeId: employee.id,
            appointment: { date: { gte: dateFrom, lte: dateTo }, status: 'completed' },
          },
          select: { price: true },
        }),
      ]);

      const revenue = invoiceItems.reduce(
        (sum, item) => sum + Number(item.price),
        0,
      );

      result.push({
        employee,
        appointmentsCount,
        revenue,
      });
    }

    return result.sort((a, b) => b.revenue - a.revenue);
  }

  async getServices(
    db: TenantPrismaClient,
    query: ReportQueryDto,
  ): Promise<ServiceReportItem[]> {
    const dateFrom = new Date(query.dateFrom);
    const dateTo = new Date(query.dateTo);

    const services = await db.service.findMany({
      where: { isActive: true },
      select: { id: true, nameAr: true, nameEn: true, price: true },
    });

    const result: ServiceReportItem[] = [];

    for (const service of services) {
      const appointmentServices = await db.appointmentService.findMany({
        where: {
          serviceId: service.id,
          appointment: { date: { gte: dateFrom, lte: dateTo }, status: 'completed' },
        },
        select: { price: true },
      });

      const bookingsCount = appointmentServices.length;
      const revenue = appointmentServices.reduce(
        (sum, item) => sum + Number(item.price),
        0,
      );

      result.push({
        service: { ...service, price: Number(service.price) },
        bookingsCount,
        revenue,
      });
    }

    return result.sort((a, b) => b.revenue - a.revenue);
  }

  async getExpenses(
    db: TenantPrismaClient,
    query: ReportQueryDto,
  ): Promise<ExpensesResult> {
    const dateFrom = new Date(query.dateFrom);
    const dateTo = new Date(query.dateTo);

    const expenses = await db.expense.findMany({
      where: { date: { gte: dateFrom, lte: dateTo } },
      select: { category: true, amount: true },
    });

    const grouped = new Map<string, { total: number; count: number }>();

    for (const expense of expenses) {
      const existing = grouped.get(expense.category) || { total: 0, count: 0 };
      existing.total += Number(expense.amount);
      existing.count += 1;
      grouped.set(expense.category, existing);
    }

    const items: ExpenseReportItem[] = Array.from(grouped.entries()).map(
      ([category, data]) => ({
        category,
        total: data.total,
        count: data.count,
      }),
    );

    return {
      items: items.sort((a, b) => b.total - a.total),
      grandTotal: items.reduce((sum, i) => sum + i.total, 0),
    };
  }

  private getGroupKey(date: Date, groupBy?: 'day' | 'week' | 'month'): string {
    const d = new Date(date);
    switch (groupBy) {
      case 'week': {
        const dayOfWeek = d.getDay();
        const diff = d.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        const weekStart = new Date(d.setDate(diff));
        return weekStart.toISOString().split('T')[0];
      }
      case 'month':
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      case 'day':
      default:
        return d.toISOString().split('T')[0];
    }
  }
}
