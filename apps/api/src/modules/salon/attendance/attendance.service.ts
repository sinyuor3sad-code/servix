import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { TenantPrismaClient } from '../../../shared/types';
import { EventsGateway } from '../../../shared/events';
import { QueryAttendanceDto } from './dto/query-attendance.dto';
import { paginate, effectiveLimit } from '../../../shared/helpers/paginate.helper';


@Injectable()
export class AttendanceService {
  constructor(private readonly eventsGateway: EventsGateway) {}
  private getTodayDate(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  private getCurrentTime(): string {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  }

  /** Compute effective status: present | absent | on_break | off_duty (CLAUDE.md) */
  private computeStatus(record: {
    checkIn: string | null;
    checkOut: string | null;
    isOnBreak?: boolean;
  }): 'present' | 'absent' | 'on_break' | 'off_duty' {
    if (!record.checkIn) return 'absent';
    if (record.checkOut) return 'off_duty';
    if (record.isOnBreak) return 'on_break';
    return 'present';
  }

  private enrichWithComputedStatus(
    _db: TenantPrismaClient,
    record: Record<string, unknown>,
  ): Record<string, unknown> {
    const status = this.computeStatus({
      checkIn: record.checkIn as string | null,
      checkOut: record.checkOut as string | null,
      isOnBreak: record.isOnBreak as boolean | undefined,
    });
    return { ...record, computedStatus: status };
  }

  async findAll(
    db: TenantPrismaClient,
    query: QueryAttendanceDto,
  ): Promise<ReturnType<typeof paginate>> {
    const { page, employeeId, date, dateFrom, dateTo, status } = query;
    const limit = effectiveLimit(query);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (employeeId) where.employeeId = employeeId;
    if (status) where.status = status;

    if (date) {
      where.date = new Date(date);
    } else if (dateFrom || dateTo) {
      const dateFilter: Record<string, Date> = {};
      if (dateFrom) dateFilter.gte = new Date(dateFrom);
      if (dateTo) dateFilter.lte = new Date(dateTo);
      where.date = dateFilter;
    }

    const [records, total] = await Promise.all([
      db.attendance.findMany({
        where,
        include: { employee: { select: { id: true, fullName: true, role: true } } },
        skip,
        take: limit,
        orderBy: { date: 'desc' },
      }),
      db.attendance.count({ where }),
    ]);

    return paginate(records as unknown as Record<string, unknown>[], total, page, limit);
  }

  async checkIn(
    db: TenantPrismaClient,
    employeeId: string,
    tenantId?: string,
  ): Promise<Record<string, unknown>> {
    const employee = await db.employee.findUnique({
      where: { id: employeeId },
    });
    if (!employee) {
      throw new NotFoundException('الموظف غير موجود');
    }

    const today = this.getTodayDate();
    const existing = await db.attendance.findUnique({
      where: { employeeId_date: { employeeId, date: today } },
    });

    if (existing) {
      throw new BadRequestException('الموظف سجّل حضوره مسبقاً اليوم');
    }

    const record = await db.attendance.create({
      data: {
        employeeId,
        date: today,
        checkIn: this.getCurrentTime(),
        status: 'present',
      },
      include: { employee: { select: { id: true, fullName: true, role: true } } },
    });

    const result = this.enrichWithComputedStatus(db, record as unknown as Record<string, unknown>);
    if (tenantId) {
      this.eventsGateway.emitToTenant(tenantId, 'attendance:updated', result);
    }
    return result;
  }

  async toggleBreak(
    db: TenantPrismaClient,
    employeeId: string,
    tenantId?: string,
  ): Promise<Record<string, unknown>> {
    const today = this.getTodayDate();
    const existing = await db.attendance.findUnique({
      where: { employeeId_date: { employeeId, date: today } },
    });

    if (!existing) {
      throw new BadRequestException('الموظف لم يسجّل حضوره اليوم');
    }

    if (existing.checkOut) {
      throw new BadRequestException('الموظف أنهى دوامه');
    }

    const record = await db.attendance.update({
      where: { id: existing.id },
      data: { isOnBreak: !existing.isOnBreak },
      include: { employee: { select: { id: true, fullName: true, role: true } } },
    });

    const result = this.enrichWithComputedStatus(db, record);
    if (tenantId) {
      this.eventsGateway.emitToTenant(tenantId, 'attendance:updated', result);
    }
    return result;
  }

  async checkOut(
    db: TenantPrismaClient,
    employeeId: string,
    tenantId?: string,
  ): Promise<Record<string, unknown>> {
    const today = this.getTodayDate();
    const existing = await db.attendance.findUnique({
      where: { employeeId_date: { employeeId, date: today } },
    });

    if (!existing) {
      throw new BadRequestException('الموظف لم يسجّل حضوره اليوم');
    }

    if (existing.checkOut) {
      throw new BadRequestException('الموظف سجّل انصرافه مسبقاً');
    }

    const record = await db.attendance.update({
      where: { id: existing.id },
      data: { checkOut: this.getCurrentTime() },
      include: { employee: { select: { id: true, fullName: true, role: true } } },
    });

    const result = this.enrichWithComputedStatus(db, record as unknown as Record<string, unknown>);
    if (tenantId) {
      this.eventsGateway.emitToTenant(tenantId, 'attendance:updated', result);
    }
    return result;
  }

  /** Get today's attendance including scheduled-but-absent employees (CLAUDE.md: 4 statuses) */
  async getToday(
    db: TenantPrismaClient,
  ): Promise<Record<string, unknown>[]> {
    const today = this.getTodayDate();
    const dayOfWeek = today.getDay();

    const [attendanceRecords, scheduledEmployees] = await Promise.all([
      db.attendance.findMany({
        where: { date: today },
        include: { employee: { select: { id: true, fullName: true, role: true, avatarUrl: true } } },
        orderBy: { checkIn: 'asc' },
      }),
      db.employee.findMany({
        where: {
          isActive: true,
          employeeSchedules: {
            some: {
              dayOfWeek,
              isDayOff: false,
            },
          },
        },
        select: { id: true, fullName: true, role: true, avatarUrl: true },
      }),
    ]);

    const attendedIds = new Set(attendanceRecords.map((r) => r.employeeId));
    const absentEmployees = scheduledEmployees.filter((e) => !attendedIds.has(e.id));

    const result: Record<string, unknown>[] = attendanceRecords.map((r) =>
      this.enrichWithComputedStatus(db, r as unknown as Record<string, unknown>),
    );

    for (const emp of absentEmployees) {
      result.push({
        id: null,
        employeeId: emp.id,
        date: today,
        checkIn: null,
        checkOut: null,
        isOnBreak: false,
        computedStatus: 'absent',
        employee: emp,
      });
    }

    return result.sort((a, b) => {
      const aIn = a.checkIn as string | null;
      const bIn = b.checkIn as string | null;
      if (!aIn) return 1;
      if (!bIn) return -1;
      return aIn.localeCompare(bIn);
    });
  }

  async getEmployeeHistory(
    db: TenantPrismaClient,
    employeeId: string,
    query: QueryAttendanceDto,
  ): Promise<ReturnType<typeof paginate>> {
    const employee = await db.employee.findUnique({
      where: { id: employeeId },
    });
    if (!employee) {
      throw new NotFoundException('الموظف غير موجود');
    }

    const { page, dateFrom, dateTo } = query;
    const limit = effectiveLimit(query);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { employeeId };
    if (dateFrom || dateTo) {
      const dateFilter: Record<string, Date> = {};
      if (dateFrom) dateFilter.gte = new Date(dateFrom);
      if (dateTo) dateFilter.lte = new Date(dateTo);
      where.date = dateFilter;
    }

    const [records, total] = await Promise.all([
      db.attendance.findMany({
        where,
        skip,
        take: limit,
        orderBy: { date: 'desc' },
      }),
      db.attendance.count({ where }),
    ]);

    return paginate(records as unknown as Record<string, unknown>[], total, page, limit);
  }
}
