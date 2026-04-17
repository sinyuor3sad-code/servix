import { Injectable, Logger } from '@nestjs/common';
import { TenantPrismaClient } from '@shared/types';
import { CommitmentsService } from '../commitments/commitments.service';

export type HealingEvaluationResult = {
  appointmentId: string;
  strategy: 'reassign' | 'time_shift' | 'compensate' | 'escalate' | 'none';
  applied: boolean;
};

function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const totalMinutes = h * 60 + m + minutes;
  const newH = Math.floor(totalMinutes / 60) % 24;
  const newM = totalMinutes % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}

@Injectable()
export class HealingService {
  private readonly logger = new Logger(HealingService.name);

  constructor(private readonly commitmentsService: CommitmentsService) {}

  /**
   * Main entry point: Given a broken commitment, find all dependent commitments
   * (appointments that depended on that shift) and try to heal each one.
   * Strategy priority: reassign → time_shift → compensate → escalate
   */
  async evaluateAndHeal(
    db: TenantPrismaClient,
    brokenCommitmentId: string,
  ): Promise<HealingEvaluationResult[]> {
    const dependents = await this.commitmentsService.findDependents(db, brokenCommitmentId);
    const results: HealingEvaluationResult[] = [];

    for (const dependent of dependents) {
      if (dependent.type !== 'appointment' || dependent.state === 'healed' || dependent.state === 'cancelled') {
        continue;
      }

      const appointmentId = dependent.referenceId;
      let healed = false;

      // Strategy 1: Try to reassign to another available employee
      healed = await this.tryReassign(db, appointmentId);
      if (healed) {
        await this.commitmentsService.heal(db, dependent.id, 'reassigned', 'تم إعادة التوزيع تلقائياً لموظفة متاحة');
        results.push({ appointmentId, strategy: 'reassign', applied: true });
        continue;
      }

      // Strategy 2: Try to shift the appointment time forward
      healed = await this.tryTimeShift(db, appointmentId, 15);
      if (healed) {
        await this.commitmentsService.heal(db, dependent.id, 'time_shifted', 'تم تأخير الموعد 15 دقيقة');
        results.push({ appointmentId, strategy: 'time_shift', applied: true });
        continue;
      }

      // Strategy 3: Compensate the client with a coupon
      const compensation = await this.compensateClient(db, appointmentId);
      if (compensation.couponId) {
        await this.commitmentsService.heal(db, dependent.id, 'client_compensated', `كوبون تعويضي: ${compensation.couponId}`);
        results.push({ appointmentId, strategy: 'compensate', applied: true });
        continue;
      }

      // Strategy 4: Escalate to manager
      await this.escalate(db, appointmentId);
      await this.commitmentsService.heal(db, dependent.id, 'escalated', 'تم التصعيد للمدير');
      results.push({ appointmentId, strategy: 'escalate', applied: true });
    }

    return results;
  }

  /**
   * Try to reassign the appointment to another employee with:
   * - Matching skill for the appointment's services
   * - Active/scheduled shift on the same day
   * - No overlapping appointments
   */
  async tryReassign(db: TenantPrismaClient, appointmentId: string): Promise<boolean> {
    const appointment = await db.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        appointmentServices: {
          include: { service: true },
        },
      },
    });

    if (!appointment || !appointment.employeeId) return false;

    const serviceIds = appointment.appointmentServices.map((as) => as.serviceId);

    // Find employees who can do ALL services in this appointment
    const qualifiedEmployees = await db.employee.findMany({
      where: {
        isActive: true,
        id: { not: appointment.employeeId }, // Not the original employee
        employeeServices: {
          some: { serviceId: { in: serviceIds } },
        },
      },
      include: {
        employeeServices: true,
        shifts: {
          where: {
            date: appointment.date,
            status: { in: ['scheduled', 'active'] },
          },
        },
      },
    });

    for (const candidate of qualifiedEmployees) {
      // Check employee can do ALL services
      const canDoAll = serviceIds.every((sid) =>
        candidate.employeeServices.some((es) => es.serviceId === sid),
      );
      if (!canDoAll) continue;

      // Must have a shift that day
      if (candidate.shifts.length === 0) continue;

      // Check for time conflicts
      const conflict = await db.appointment.findFirst({
        where: {
          date: appointment.date,
          employeeId: candidate.id,
          status: { notIn: ['cancelled', 'no_show'] },
          id: { not: appointmentId },
          AND: [
            { startTime: { lt: appointment.endTime } },
            { endTime: { gt: appointment.startTime } },
          ],
        },
      });

      if (conflict) continue;

      // Reassign!
      await db.appointment.update({
        where: { id: appointmentId },
        data: {
          originalEmployeeId: appointment.employeeId,
          employeeId: candidate.id,
          reassignedAt: new Date(),
          reassignmentReason: 'تأخر الموظف/ة الأصلي/ة — إعادة توزيع تلقائي',
        },
      });

      // Update appointment services too
      await db.appointmentService.updateMany({
        where: {
          appointmentId,
          employeeId: appointment.employeeId,
        },
        data: { employeeId: candidate.id },
      });

      this.logger.log(
        `Reassigned appointment ${appointmentId} from ${appointment.employeeId} to ${candidate.id}`,
      );
      return true;
    }

    return false;
  }

  /**
   * Try to shift the appointment forward by delayMinutes.
   * Only if the new time doesn't conflict with other appointments.
   */
  async tryTimeShift(
    db: TenantPrismaClient,
    appointmentId: string,
    delayMinutes: number,
  ): Promise<boolean> {
    const appointment = await db.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!appointment || !appointment.employeeId) return false;

    const newStartTime = addMinutesToTime(appointment.startTime, delayMinutes);
    const newEndTime = addMinutesToTime(appointment.endTime, delayMinutes);

    // Check for conflicts at the new time
    const conflict = await db.appointment.findFirst({
      where: {
        date: appointment.date,
        employeeId: appointment.employeeId,
        status: { notIn: ['cancelled', 'no_show'] },
        id: { not: appointmentId },
        AND: [
          { startTime: { lt: newEndTime } },
          { endTime: { gt: newStartTime } },
        ],
      },
    });

    if (conflict) return false;

    await db.appointment.update({
      where: { id: appointmentId },
      data: {
        startTime: newStartTime,
        endTime: newEndTime,
        reassignmentReason: `تم تأخير الموعد ${delayMinutes} دقيقة بسبب تأخر الموظف/ة`,
        reassignedAt: new Date(),
      },
    });

    this.logger.log(
      `Time-shifted appointment ${appointmentId} by ${delayMinutes}min → ${newStartTime}-${newEndTime}`,
    );
    return true;
  }

  /**
   * Create a compensation coupon for the client and notify them.
   */
  async compensateClient(
    db: TenantPrismaClient,
    appointmentId: string,
  ): Promise<{ couponId?: string }> {
    const appointment = await db.appointment.findUnique({
      where: { id: appointmentId },
      include: { client: true },
    });

    if (!appointment) return {};

    // Create a 10% compensation coupon valid for 30 days
    const code = `COMP${Date.now().toString(36).toUpperCase()}`;
    const validFrom = new Date();
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 30);

    const coupon = await db.coupon.create({
      data: {
        code,
        type: 'percentage',
        value: 10,
        usageLimit: 1,
        validFrom,
        validUntil,
        isActive: true,
      },
    });

    // Create notification for the client
    await db.notification.create({
      data: {
        recipientType: 'client',
        recipientId: appointment.clientId,
        titleAr: 'عذراً عن التأخير',
        bodyAr: `نعتذر عن أي إزعاج. تم منحك كوبون خصم 10% (${code}) كتعويض. صالح لمدة 30 يوماً.`,
        type: 'healing',
        channel: 'whatsapp',
        data: { couponId: coupon.id, couponCode: code, appointmentId },
      },
    });

    this.logger.log(
      `Compensated client ${appointment.clientId} with coupon ${code} for appointment ${appointmentId}`,
    );

    return { couponId: coupon.id };
  }

  /**
   * Escalate to manager — notify all managers via WhatsApp + create domain event.
   */
  async escalate(db: TenantPrismaClient, appointmentId: string): Promise<void> {
    const appointment = await db.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        client: { select: { fullName: true } },
        employee: { select: { fullName: true } },
      },
    });

    if (!appointment) return;

    // Find cashiers (supervisors) to notify
    const managers = await db.employee.findMany({
      where: { role: 'cashier', isActive: true },
    });

    for (const manager of managers) {
      await db.notification.create({
        data: {
          recipientType: 'employee',
          recipientId: manager.id,
          titleAr: '⚠️ تصعيد — موعد يحتاج تدخل',
          bodyAr: `الموعد الخاص بـ ${appointment.client?.fullName || 'عميل'} (${appointment.startTime}) لم يتم حله تلقائياً. الموظف/ة: ${appointment.employee?.fullName || 'غير محدد'}. يُرجى التدخل.`,
          type: 'healing',
          channel: 'whatsapp',
          data: { appointmentId, escalatedAt: new Date().toISOString() },
        },
      });
    }

    // Create domain event
    await db.domainEvent.create({
      data: {
        eventType: 'HEALING_ESCALATED',
        aggregateType: 'appointment',
        aggregateId: appointmentId,
        payload: {
          reason: 'لم تنجح أي من استراتيجيات الشفاء التلقائي',
          managersNotified: managers.map((m) => m.id),
        },
        emittedBy: 'HealingService',
      },
    });

    this.logger.warn(`Escalated appointment ${appointmentId} to ${managers.length} manager(s)`);
  }
}
