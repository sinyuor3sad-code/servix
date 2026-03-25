import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import type { Shift } from '../../../../generated/tenant';
import { TenantPrismaClient } from '@shared/types';
import { GenerateShiftsDto } from './dto/generate-shifts.dto';

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

@Injectable()
export class ShiftsService {
  private readonly logger = new Logger(ShiftsService.name);

  async listForDate(db: TenantPrismaClient, date: string): Promise<Shift[]> {
    const day = new Date(date);
    return db.shift.findMany({
      where: { date: day },
      orderBy: [{ startTime: 'asc' }],
      include: { employee: true },
    });
  }

  /**
   * Generate concrete Shift rows for the next 7 days based on EmployeeSchedule templates.
   * Uses upsert to avoid duplicates (@@unique([employeeId, date])).
   */
  async generateWeekFromSchedules(
    db: TenantPrismaClient,
    dto: GenerateShiftsDto,
  ): Promise<{ created: number }> {
    const startDate = dto.startDate ? new Date(dto.startDate) : new Date();
    startDate.setHours(0, 0, 0, 0);

    // Load all active employees with their schedules
    const employees = await db.employee.findMany({
      where: { isActive: true },
      include: {
        employeeSchedules: true,
      },
    });

    let created = 0;

    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const targetDate = new Date(startDate);
      targetDate.setDate(targetDate.getDate() + dayOffset);
      const dayOfWeek = targetDate.getDay(); // 0=Sunday..6=Saturday

      for (const employee of employees) {
        const schedule = employee.employeeSchedules.find(
          (s) => s.dayOfWeek === dayOfWeek,
        );

        // Skip if no schedule or day off
        if (!schedule || schedule.isDayOff) continue;

        await db.shift.upsert({
          where: {
            employeeId_date: {
              employeeId: employee.id,
              date: targetDate,
            },
          },
          update: {}, // Don't overwrite existing shifts
          create: {
            employeeId: employee.id,
            date: targetDate,
            startTime: schedule.startTime,
            endTime: schedule.endTime,
            status: 'scheduled',
            maxLoad: employee.maxDailyAppointments,
            currentLoad: 0,
          },
        });

        created++;
      }
    }

    this.logger.log(`Generated ${created} shifts for 7-day window starting ${startDate.toISOString().split('T')[0]}`);
    return { created };
  }

  /**
   * Check-in for a shift. Calculates late minutes and emits STAFF_DELAYED event if > 15 min late.
   */
  async checkIn(db: TenantPrismaClient, shiftId: string): Promise<Shift> {
    const shift = await db.shift.findUnique({
      where: { id: shiftId },
      include: { employee: true },
    });

    if (!shift) {
      throw new NotFoundException('الوردية غير موجودة');
    }

    if (shift.status !== 'scheduled') {
      throw new BadRequestException(
        `لا يمكن تسجيل الحضور — الحالة الحالية: ${shift.status}`,
      );
    }

    const now = new Date();
    const shiftStartMinutes = timeToMinutes(shift.startTime);
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const lateMinutes = Math.max(0, currentMinutes - shiftStartMinutes);

    const updated = await db.shift.update({
      where: { id: shiftId },
      data: {
        status: lateMinutes > 0 ? 'late' : 'active',
        checkedInAt: now,
        lateMinutes,
      },
      include: { employee: true },
    });

    // If late > 15 minutes, emit domain event for healing engine
    if (lateMinutes > 15) {
      await db.domainEvent.create({
        data: {
          eventType: 'STAFF_DELAYED',
          aggregateType: 'shift',
          aggregateId: shiftId,
          payload: {
            employeeId: shift.employeeId,
            employeeName: shift.employee.fullName,
            shiftDate: shift.date,
            lateMinutes,
            shiftStartTime: shift.startTime,
          },
          emittedBy: 'ShiftsService',
        },
      });

      this.logger.warn(
        `Employee ${shift.employee.fullName} is ${lateMinutes} min late for shift ${shiftId}`,
      );
    }

    return updated;
  }

  /**
   * Check-out from a shift.
   */
  async checkOut(db: TenantPrismaClient, shiftId: string): Promise<Shift> {
    const shift = await db.shift.findUnique({ where: { id: shiftId } });

    if (!shift) {
      throw new NotFoundException('الوردية غير موجودة');
    }

    if (shift.status !== 'active' && shift.status !== 'late') {
      throw new BadRequestException(
        `لا يمكن تسجيل الانصراف — الحالة الحالية: ${shift.status}`,
      );
    }

    return db.shift.update({
      where: { id: shiftId },
      data: {
        status: 'completed',
        checkedOutAt: new Date(),
      },
      include: { employee: true },
    });
  }
}
