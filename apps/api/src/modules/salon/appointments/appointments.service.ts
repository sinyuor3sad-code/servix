import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { TenantPrismaClient } from '../../../shared/types';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { ChangeStatusDto, AppointmentStatusEnum } from './dto/change-status.dto';
import { QueryAppointmentsDto } from './dto/query-appointments.dto';
import { AvailableSlotsDto } from './dto/available-slots.dto';
import { CalendarQueryDto } from './dto/calendar-query.dto';
import { CommitmentsService } from '../commitments/commitments.service';
import { InventoryService } from '../inventory/inventory.service';
import { AuditService } from '../../../core/audit/audit.service';
import { paginate, effectiveLimit } from '../../../shared/helpers/paginate.helper';
import { CalendarService } from '../../../shared/calendar/calendar.service';

const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled', 'no_show'],
  confirmed: ['in_progress', 'cancelled', 'no_show'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
  no_show: [],
};

function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const totalMinutes = h * 60 + m + minutes;
  const newH = Math.floor(totalMinutes / 60) % 24;
  const newM = totalMinutes % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name);

  constructor(
    private readonly commitmentsService: CommitmentsService,
    private readonly inventoryService: InventoryService,
    private readonly auditService: AuditService,
    private readonly calendarService: CalendarService,
  ) {}
  async findAll(
    db: TenantPrismaClient,
    query: QueryAppointmentsDto,
  ) {
    const { page, sort, order, date, dateFrom, dateTo, status, employeeId, clientId } =
      query;
    const limit = effectiveLimit(query);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (date) {
      where.date = new Date(date);
    } else {
      if (dateFrom || dateTo) {
        const dateFilter: Record<string, Date> = {};
        if (dateFrom) dateFilter.gte = new Date(dateFrom);
        if (dateTo) dateFilter.lte = new Date(dateTo);
        where.date = dateFilter;
      }
    }

    if (status) where.status = status;
    if (employeeId) where.employeeId = employeeId;
    if (clientId) where.clientId = clientId;

    const [data, total] = await Promise.all([
      db.appointment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sort || 'date']: order || 'desc' },
        include: {
          client: { select: { id: true, fullName: true, phone: true } },
          employee: { select: { id: true, fullName: true } },
          appointmentServices: {
            include: {
              service: { select: { id: true, nameAr: true, nameEn: true, duration: true } },
              employee: { select: { id: true, fullName: true } },
            },
          },
        },
      }),
      db.appointment.count({ where }),
    ]);

    return paginate(data as unknown as Record<string, unknown>[], total, page, limit);
  }

  async create(
    db: TenantPrismaClient,
    dto: CreateAppointmentDto,
  ): Promise<Record<string, unknown>> {
    const client = await db.client.findFirst({
      where: { id: dto.clientId, deletedAt: null },
    });
    if (!client) {
      throw new NotFoundException('العميل غير موجود');
    }

    const serviceIds = dto.services.map((s) => s.serviceId);
    const services = await db.service.findMany({
      where: { id: { in: serviceIds }, isActive: true },
    });

    if (services.length !== serviceIds.length) {
      throw new BadRequestException('بعض الخدمات المحددة غير موجودة أو غير نشطة');
    }

    const totalDuration = services.reduce((sum, s) => sum + s.duration, 0);
    const totalPrice = services.reduce((sum, s) => sum + Number(s.price), 0);
    const endTime = addMinutesToTime(dto.startTime, totalDuration);

    const employeeIds = [...new Set(dto.services.map((s) => s.employeeId))];

    // D16: Check if any employee is on vacation or day-off
    const appointmentDate = new Date(dto.date);
    const dayOfWeek = appointmentDate.getDay();

    for (const empId of employeeIds) {
      // Check attendance (vacation/absent)
      const attendance = await db.attendance.findUnique({
        where: { employeeId_date: { employeeId: empId, date: appointmentDate } },
      });
      if (attendance && ['vacation', 'absent'].includes(attendance.status)) {
        const emp = await db.employee.findUnique({ where: { id: empId }, select: { fullName: true } });
        throw new BadRequestException(
          `الموظف/ة ${emp?.fullName || ''} في إجازة في هذا التاريخ`,
        );
      }

      // Check schedule (day off)
      const schedule = await db.employeeSchedule.findUnique({
        where: { employeeId_dayOfWeek: { employeeId: empId, dayOfWeek } },
      });
      if (schedule?.isDayOff) {
        const emp = await db.employee.findUnique({ where: { id: empId }, select: { fullName: true } });
        throw new BadRequestException(
          `الموظف/ة ${emp?.fullName || ''} لا يعمل في هذا اليوم`,
        );
      }
    }

    let appointment: Record<string, unknown> | null;

    try {
      appointment = await db.$transaction(async (tx) => {
        // 1. Lock conflicting rows with SELECT FOR UPDATE to prevent race condition
        for (const empId of employeeIds) {
          const conflicts = await tx.$queryRaw<{ id: string }[]>`
            SELECT id FROM "appointments"
            WHERE "employee_id" = ${empId}::uuid
            AND "date" = ${new Date(dto.date)}::date
            AND "start_time" < ${endTime}
            AND "end_time" > ${dto.startTime}
            AND "status" NOT IN ('cancelled', 'no_show')
            FOR UPDATE
          `;

          if (conflicts.length > 0) {
            throw new ConflictException(
              'يوجد تعارض في المواعيد مع أحد الموظفين المحددين',
            );
          }
        }

        // 2. Create the appointment inside the same transaction
        const created = await tx.appointment.create({
          data: {
            clientId: dto.clientId,
            employeeId: dto.employeeId || dto.services[0].employeeId,
            date: new Date(dto.date),
            startTime: dto.startTime,
            endTime,
            totalPrice,
            totalDuration,
            notes: dto.notes,
          },
        });

        await tx.appointmentService.createMany({
          data: dto.services.map((s) => {
            const svc = services.find((sv) => sv.id === s.serviceId)!;
            return {
              appointmentId: created.id,
              serviceId: s.serviceId,
              employeeId: s.employeeId,
              price: Number(svc.price),
              duration: svc.duration,
            };
          }),
        });

        return tx.appointment.findUnique({
          where: { id: created.id },
          include: {
            client: { select: { id: true, fullName: true, phone: true } },
            employee: { select: { id: true, fullName: true } },
            appointmentServices: {
              include: {
                service: { select: { id: true, nameAr: true, nameEn: true } },
                employee: { select: { id: true, fullName: true } },
              },
            },
          },
        });
      });
    } catch (error: unknown) {
      // 3. Handle UNIQUE constraint violation (P2002) as a conflict
      if (error instanceof ConflictException) {
        throw error;
      }
      const prismaError = error as { code?: string };
      if (prismaError.code === 'P2002') {
        throw new ConflictException('هذا الموعد محجوز بالفعل');
      }
      throw error;
    }

    // --- Commitment Engine Integration ---
    try {
      const apptDate = new Date(dto.date);
      const [sh, sm] = dto.startTime.split(':').map(Number);
      const startsAt = new Date(apptDate);
      startsAt.setHours(sh, sm, 0, 0);
      const endsAt = new Date(startsAt.getTime() + totalDuration * 60 * 1000);
      const empId = dto.employeeId || dto.services[0].employeeId;

      const apptCommitment = await this.commitmentsService.create(
        db, 'appointment', (appointment as Record<string, unknown>).id as string,
        empId, dto.clientId, startsAt, endsAt,
      );

      // Link to shift commitment if one exists
      const shiftCommitment = await db.commitment.findFirst({
        where: {
          type: 'shift',
          ownerEmployeeId: empId,
          startsAt: { lte: startsAt },
          endsAt: { gte: endsAt },
          state: { in: ['pledged', 'confirmed', 'in_progress'] },
        },
      });

      if (shiftCommitment) {
        await this.commitmentsService.linkDependency(
          db, apptCommitment.id, shiftCommitment.id, true,
        );
      }
    } catch (err) {
      this.logger.warn(`Failed to create commitment for appointment: ${err}`);
    }

    // Audit log (fire-and-forget)
    this.auditService.log({
      userId: dto.clientId,
      action: 'appointment.create',
      entityType: 'Appointment',
      entityId: (appointment as Record<string, unknown>).id as string,
      newValues: { date: dto.date, startTime: dto.startTime, employeeId: dto.employeeId },
    }).catch(() => {});

    // Generate calendar URL for the appointment
    let calendarUrl: string | undefined;
    try {
      const appt = appointment as Record<string, any>;
      const apptDate = new Date(dto.date);
      const [startH, startM] = dto.startTime.split(':').map(Number);
      apptDate.setHours(startH, startM, 0, 0);

      // Get salon info for location
      const salonInfo = await db.salonInfo.findFirst();
      const salonName = salonInfo?.nameAr || salonInfo?.nameEn || '';
      const salonAddress = salonInfo?.address || salonInfo?.city || '';

      // Build service names
      const serviceNames = (appt.appointmentServices || [])
        .map((as: any) => as.service?.nameAr || '')
        .filter(Boolean)
        .join(' + ');

      const employeeName = appt.employee?.fullName || '';

      calendarUrl = this.calendarService.generateAppointmentCalendarUrl({
        serviceName: serviceNames || 'موعد',
        employeeName,
        salonName,
        salonAddress,
        startDate: apptDate,
        durationMinutes: totalDuration,
        price: totalPrice,
      });
    } catch (err) {
      this.logger.warn(`Failed to generate calendar URL: ${err}`);
    }

    return {
      ...(appointment as Record<string, unknown>),
      calendarUrl,
    };
  }

  async findOne(
    db: TenantPrismaClient,
    id: string,
  ): Promise<Record<string, unknown>> {
    const appointment = await db.appointment.findUnique({
      where: { id },
      include: {
        client: true,
        employee: true,
        appointmentServices: {
          include: {
            service: true,
            employee: true,
          },
        },
      },
    });

    if (!appointment) {
      throw new NotFoundException('الموعد غير موجود');
    }

    return appointment as unknown as Record<string, unknown>;
  }

  async update(
    db: TenantPrismaClient,
    id: string,
    dto: UpdateAppointmentDto,
  ): Promise<Record<string, unknown>> {
    const existing = await db.appointment.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('الموعد غير موجود');
    }

    if (!['pending', 'confirmed'].includes(existing.status)) {
      throw new BadRequestException(
        'لا يمكن تعديل الموعد إلا إذا كان بحالة معلّق أو مؤكد',
      );
    }

    const updateData: Record<string, unknown> = {};
    if (dto.date) updateData.date = new Date(dto.date);
    if (dto.startTime) {
      updateData.startTime = dto.startTime;
      updateData.endTime = addMinutesToTime(dto.startTime, existing.totalDuration);
    }
    if (dto.notes !== undefined) updateData.notes = dto.notes;
    if (dto.employeeId) updateData.employeeId = dto.employeeId;

    const appointment = await db.appointment.update({
      where: { id },
      data: updateData,
      include: {
        client: { select: { id: true, fullName: true, phone: true } },
        employee: { select: { id: true, fullName: true } },
        appointmentServices: {
          include: {
            service: { select: { id: true, nameAr: true, nameEn: true } },
            employee: { select: { id: true, fullName: true } },
          },
        },
      },
    });

    // Audit log (fire-and-forget)
    this.auditService.log({
      userId: id,
      action: 'appointment.update',
      entityType: 'Appointment',
      entityId: id,
      newValues: updateData,
    }).catch(() => {});

    return appointment as unknown as Record<string, unknown>;
  }

  async changeStatus(
    db: TenantPrismaClient,
    id: string,
    dto: ChangeStatusDto,
  ): Promise<Record<string, unknown>> {
    const existing = await db.appointment.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('الموعد غير موجود');
    }

    const allowed = VALID_STATUS_TRANSITIONS[existing.status];
    if (!allowed || !allowed.includes(dto.status)) {
      throw new BadRequestException(
        `لا يمكن تغيير الحالة من "${existing.status}" إلى "${dto.status}"`,
      );
    }

    const updateData: Record<string, unknown> = {
      status: dto.status,
    };

    if (dto.status === AppointmentStatusEnum.cancelled) {
      updateData.cancelledAt = new Date();
      updateData.cancellationReason = dto.cancellationReason;
    }

    const appointment = await db.$transaction(async (tx) => {
      const updated = await tx.appointment.update({
        where: { id },
        data: updateData,
        include: {
          client: { select: { id: true, fullName: true, phone: true } },
          employee: { select: { id: true, fullName: true } },
        },
      });

      if (dto.status === AppointmentStatusEnum.completed) {
        await tx.client.update({
          where: { id: existing.clientId },
          data: {
            totalVisits: { increment: 1 },
            totalSpent: { increment: Number(existing.totalPrice) },
            lastVisitAt: new Date(),
          },
        });

        // Auto-deduct inventory for completed appointment
        try {
          await this.inventoryService.autoDeductForAppointment(tx as unknown as TenantPrismaClient, id);
        } catch (err) {
          this.logger.warn(`Inventory auto-deduct failed for appointment ${id}: ${err}`);
        }
      }

      return updated;
    });

    // Audit log (fire-and-forget)
    this.auditService.log({
      userId: id,
      action: `appointment.${dto.status}`,
      entityType: 'Appointment',
      entityId: id,
      oldValues: { status: existing.status },
      newValues: { status: dto.status },
    }).catch(() => {});

    return appointment as unknown as Record<string, unknown>;
  }

  async cancel(
    db: TenantPrismaClient,
    id: string,
  ): Promise<Record<string, unknown>> {
    return this.changeStatus(db, id, {
      status: AppointmentStatusEnum.cancelled,
      cancellationReason: 'تم الإلغاء بواسطة المستخدم',
    });
  }

  async getToday(
    db: TenantPrismaClient,
  ): Promise<Record<string, unknown>[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const appointments = await db.appointment.findMany({
      where: { date: today },
      orderBy: { startTime: 'asc' },
      include: {
        client: { select: { id: true, fullName: true, phone: true } },
        employee: { select: { id: true, fullName: true } },
        appointmentServices: {
          include: {
            service: { select: { id: true, nameAr: true, nameEn: true, duration: true } },
            employee: { select: { id: true, fullName: true } },
          },
        },
      },
    });

    return appointments as unknown as Record<string, unknown>[];
  }

  async getUpcoming(
    db: TenantPrismaClient,
  ): Promise<Record<string, unknown>[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    const appointments = await db.appointment.findMany({
      where: {
        date: { gte: today, lte: nextWeek },
        status: { in: ['pending', 'confirmed'] },
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      include: {
        client: { select: { id: true, fullName: true, phone: true } },
        employee: { select: { id: true, fullName: true } },
        appointmentServices: {
          include: {
            service: { select: { id: true, nameAr: true, nameEn: true } },
          },
        },
      },
    });

    return appointments as unknown as Record<string, unknown>[];
  }

  async getAvailableSlots(
    db: TenantPrismaClient,
    query: AvailableSlotsDto,
  ): Promise<{ time: string; available: boolean }[]> {
    const { date, employeeId, serviceIds } = query;
    const targetDate = new Date(date);
    const dayOfWeek = targetDate.getDay();

    const services = await db.service.findMany({
      where: { id: { in: serviceIds }, isActive: true },
    });
    if (services.length === 0) {
      throw new BadRequestException('لم يتم العثور على خدمات نشطة');
    }

    const totalDuration = services.reduce((sum, s) => sum + s.duration, 0);

    const salon = await db.salonInfo.findFirst();
    const openingTime = salon?.openingTime || '09:00';
    const closingTime = salon?.closingTime || '22:00';
    const slotDuration = salon?.slotDuration || 30;
    const bufferTime = salon?.bufferTime || 10;

    let scheduleStart = openingTime;
    let scheduleEnd = closingTime;

    if (employeeId) {
      const schedule = await db.employeeSchedule.findUnique({
        where: { employeeId_dayOfWeek: { employeeId, dayOfWeek } },
      });

      if (schedule?.isDayOff) {
        return [];
      }

      if (schedule) {
        scheduleStart = schedule.startTime;
        scheduleEnd = schedule.endTime;
      }
    }

    const existingAppointments = await db.appointment.findMany({
      where: {
        date: targetDate,
        status: { notIn: ['cancelled', 'no_show'] },
        ...(employeeId
          ? {
              OR: [
                { employeeId },
                { appointmentServices: { some: { employeeId } } },
              ],
            }
          : {}),
      },
      select: { startTime: true, endTime: true },
    });

    let breakTimes: { startTime: string; endTime: string }[] = [];
    if (employeeId) {
      breakTimes = await db.employeeBreak.findMany({
        where: { employeeId, dayOfWeek },
        select: { startTime: true, endTime: true },
      });
    }

    const slots: { time: string; available: boolean }[] = [];
    const startMinutes = timeToMinutes(scheduleStart);
    const endMinutes = timeToMinutes(scheduleEnd);

    for (let m = startMinutes; m + totalDuration <= endMinutes; m += slotDuration) {
      const slotStart = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
      const hasConflict = existingAppointments.some((appt) => {
        const apptStart = timeToMinutes(appt.startTime);
        const apptEnd = timeToMinutes(appt.endTime) + bufferTime;
        const sStart = m;
        const sEnd = m + totalDuration;
        return sStart < apptEnd && sEnd > apptStart;
      });

      const duringBreak = breakTimes.some((brk) => {
        const brkStart = timeToMinutes(brk.startTime);
        const brkEnd = timeToMinutes(brk.endTime);
        const sEnd = m + totalDuration;
        return m < brkEnd && sEnd > brkStart;
      });

      slots.push({
        time: slotStart,
        available: !hasConflict && !duringBreak,
      });
    }

    return slots;
  }

  async getCalendar(
    db: TenantPrismaClient,
    query: CalendarQueryDto,
  ): Promise<Record<string, Record<string, unknown>[]>> {
    const appointments = await db.appointment.findMany({
      where: {
        date: {
          gte: new Date(query.startDate),
          lte: new Date(query.endDate),
        },
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      include: {
        client: { select: { id: true, fullName: true, phone: true } },
        employee: { select: { id: true, fullName: true } },
        appointmentServices: {
          include: {
            service: { select: { id: true, nameAr: true, nameEn: true } },
          },
        },
      },
    });

    const grouped: Record<string, Record<string, unknown>[]> = {};
    for (const appt of appointments) {
      const dateKey = (appt.date as Date).toISOString().split('T')[0];
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(appt as unknown as Record<string, unknown>);
    }

    return grouped;
  }
}
