import { Injectable, Logger } from '@nestjs/common';
import { AppointmentsService } from '../appointments/appointments.service';
import type { TenantPrismaClient } from '../../../shared/types';

export interface AvailabilitySlot {
  time: string;
  displayTime: string;
  employeeId: string;
}

export interface AvailabilityResult {
  status:
    | 'available'
    | 'needs_service'
    | 'ambiguous_date'
    | 'ambiguous_time'
    | 'incomplete_availability_data'
    | 'unavailable'
    | 'error';
  dateIso?: string;
  time?: string;
  slots?: AvailabilitySlot[];
  reason?: string;
}

export interface AppointmentCreationResult {
  status:
    | 'created'
    | 'conflict'
    | 'ambiguous_date'
    | 'ambiguous_time'
    | 'incomplete_availability_data'
    | 'stale_action'
    | 'error';
  appointmentId?: string;
  serviceName?: string;
  dateIso?: string;
  startTime?: string;
  displayTime?: string;
  price?: number;
  employeeId?: string;
  payload?: Record<string, unknown>;
  reason?: string;
}

type ParsedDate = { ok: true; value: string } | { ok: false; reason: 'ambiguous_date' };
type ParsedTime = { ok: true; value: string } | { ok: false; reason: 'ambiguous_time' };

interface ServiceRecord {
  id: string;
  nameAr?: string | null;
  nameEn?: string | null;
  price: unknown;
  duration: number;
}

interface EmployeeRecord {
  id: string;
  employeeSchedules?: Array<{ startTime: string; endTime: string; isDayOff: boolean }>;
  employeeBreaks?: Array<{ startTime: string; endTime: string }>;
}

interface ExistingAppointment {
  employeeId?: string | null;
  startTime: string;
  endTime: string;
  appointmentServices?: Array<{ employeeId: string }>;
}

@Injectable()
export class AIReceptionBookingService {
  private readonly logger = new Logger(AIReceptionBookingService.name);
  private readonly timeZone = 'Asia/Riyadh';

  constructor(private readonly appointmentsService: AppointmentsService) {}

  async getAvailableSlotsForConversation(
    db: TenantPrismaClient,
    params: {
      serviceId?: string;
      dateText?: string;
      limit?: number;
      now?: Date;
    },
  ): Promise<AvailabilityResult> {
    if (!params.serviceId) return { status: 'needs_service', reason: 'missing_service' };

    const parsedDate = this.parseDateText(params.dateText || '', params.now);
    if (!parsedDate.ok) return { status: parsedDate.reason };

    try {
      const service = await this.findActiveService(db, params.serviceId);
      if (!service) {
        return { status: 'incomplete_availability_data', dateIso: parsedDate.value, reason: 'service_not_found' };
      }

      const slots = await this.findAvailableSlots(db, {
        service,
        dateIso: parsedDate.value,
        limit: params.limit || 3,
        now: params.now,
      });

      return slots.length
        ? { status: 'available', dateIso: parsedDate.value, slots }
        : { status: 'unavailable', dateIso: parsedDate.value, slots: [] };
    } catch (error) {
      this.logger.warn(`AI availability lookup failed: ${(error as Error).message}`);
      return { status: 'error', dateIso: parsedDate.value, reason: 'availability_read_failed' };
    }
  }

  async verifyRequestedSlot(
    db: TenantPrismaClient,
    params: {
      serviceId?: string;
      dateText?: string;
      timeText?: string;
      employeeId?: string;
      now?: Date;
    },
  ): Promise<AvailabilityResult> {
    if (!params.serviceId) return { status: 'needs_service', reason: 'missing_service' };

    const parsedDate = this.parseDateText(params.dateText || '', params.now);
    if (!parsedDate.ok) return { status: parsedDate.reason };

    const parsedTime = this.parseTimeText(params.timeText || '');
    if (!parsedTime.ok) return { status: parsedTime.reason, dateIso: parsedDate.value };

    try {
      const service = await this.findActiveService(db, params.serviceId);
      if (!service) {
        return { status: 'incomplete_availability_data', dateIso: parsedDate.value, reason: 'service_not_found' };
      }

      const employeeId = await this.findAvailableEmployeeForTime(db, {
        service,
        dateIso: parsedDate.value,
        startTime: parsedTime.value,
        employeeId: params.employeeId,
        now: params.now,
      });

      if (!employeeId) {
        const slots = await this.findAvailableSlots(db, {
          service,
          dateIso: parsedDate.value,
          limit: 3,
          now: params.now,
        });
        return { status: 'unavailable', dateIso: parsedDate.value, time: parsedTime.value, slots };
      }

      return {
        status: 'available',
        dateIso: parsedDate.value,
        time: parsedTime.value,
        slots: [{
          time: parsedTime.value,
          displayTime: this.formatTimeForCustomer(parsedTime.value),
          employeeId,
        }],
      };
    } catch (error) {
      this.logger.warn(`AI slot verification failed: ${(error as Error).message}`);
      return { status: 'error', dateIso: parsedDate.value, time: parsedTime.value, reason: 'availability_verify_failed' };
    }
  }

  async createConfirmedAppointmentFromAction(
    db: TenantPrismaClient,
    params: {
      action: {
        id: number;
        status: string;
        payload: unknown;
        customerPhone: string;
        conversationId: string;
        doNotDisturb?: boolean;
        expiresAt?: Date;
      };
      allowedStatuses: string[];
      claimStatus: 'approved' | 'customer_accepted_alternative';
      actorPhone: string;
      timeTextOverride?: string;
      now?: Date;
    },
  ): Promise<AppointmentCreationResult> {
    const now = params.now || new Date();
    if (!params.allowedStatuses.includes(params.action.status) || params.action.doNotDisturb) {
      return { status: 'stale_action', reason: 'action_not_processable' };
    }
    if (params.action.expiresAt && params.action.expiresAt <= now) {
      return { status: 'stale_action', reason: 'action_expired' };
    }

    const payload = this.asObject(params.action.payload);
    const serviceId = this.asString(payload.serviceId);
    const parsedDate = this.parseDateText(this.asString(payload.appointmentDate || payload.date), now);
    const parsedTime = this.parseTimeText(
      params.timeTextOverride ||
      this.asString(payload.appointmentStartTime || payload.time || payload.alternativeTime),
    );

    if (!serviceId) return { status: 'incomplete_availability_data', reason: 'missing_service' };
    if (!parsedDate.ok) return { status: parsedDate.reason };
    if (!parsedTime.ok) return { status: parsedTime.reason, dateIso: parsedDate.value };

    const claimed = await this.claimAction(db, {
      actionId: params.action.id,
      allowedStatuses: params.allowedStatuses,
      claimStatus: params.claimStatus,
      actorPhone: params.actorPhone,
      now,
      payload: this.mergePayloadMetadata(params.action.payload, {
        appointmentClaimedAt: now.toISOString(),
        appointmentClaimedBy: params.actorPhone,
        appointmentDate: parsedDate.value,
        appointmentStartTime: parsedTime.value,
      }),
    });
    if (!claimed) return { status: 'stale_action', reason: 'claim_failed' };

    try {
      const service = await this.findActiveService(db, serviceId);
      if (!service) {
        await this.releaseClaim(db, params.action.id, params.allowedStatuses[0], params.action.payload, {
          appointmentCreateFailedAt: now.toISOString(),
          appointmentCreateFailedReason: 'service_not_found',
        });
        return { status: 'incomplete_availability_data', reason: 'service_not_found' };
      }

      const employeeId = await this.findAvailableEmployeeForTime(db, {
        service,
        dateIso: parsedDate.value,
        startTime: parsedTime.value,
        employeeId: this.asString(payload.employeeId),
        now,
      });
      if (!employeeId) {
        await this.releaseClaim(db, params.action.id, 'awaiting_manager', params.action.payload, {
          appointmentConflictAt: now.toISOString(),
          appointmentConflictReason: 'slot_unavailable',
        });
        return {
          status: 'conflict',
          serviceName: this.serviceName(service),
          dateIso: parsedDate.value,
          startTime: parsedTime.value,
          displayTime: this.formatTimeForCustomer(parsedTime.value),
          price: Number(service.price),
          reason: 'slot_unavailable',
        };
      }

      const client = await this.findOrCreateClient(db, {
        phone: params.action.customerPhone,
        name: this.asString(payload.clientName || payload.customerName) || params.action.customerPhone,
      });

      const appointment = await this.appointmentsService.create(db, {
        clientId: client.id,
        employeeId,
        date: parsedDate.value,
        startTime: parsedTime.value,
        source: 'whatsapp',
        notes: `AI reception request #${params.action.id}`,
        services: [{ serviceId, employeeId }],
      });

      const appointmentId = String(appointment.id);
      const nextPayload = this.mergePayloadMetadata(claimed.payload, {
        appointmentId,
        appointmentCreatedAt: new Date().toISOString(),
        appointmentCreatedBy: params.actorPhone,
        appointmentDate: parsedDate.value,
        appointmentStartTime: parsedTime.value,
        employeeId,
      });
      nextPayload.appointmentId = appointmentId;
      nextPayload.appointmentDate = parsedDate.value;
      nextPayload.appointmentStartTime = parsedTime.value;
      nextPayload.employeeId = employeeId;

      await (db as any).aIPendingAction.update({
        where: { id: params.action.id },
        data: {
          status: 'approved',
          resolvedAt: new Date(),
          resolvedBy: params.actorPhone,
          payload: nextPayload,
        },
      });

      return {
        status: 'created',
        appointmentId,
        serviceName: this.serviceName(service),
        dateIso: parsedDate.value,
        startTime: parsedTime.value,
        displayTime: this.formatTimeForCustomer(parsedTime.value),
        price: Number(service.price),
        employeeId,
        payload: nextPayload,
      };
    } catch (error) {
      await this.releaseClaim(db, params.action.id, 'awaiting_manager', params.action.payload, {
        appointmentCreateFailedAt: new Date().toISOString(),
        appointmentCreateFailedReason: (error as Error).message,
      }).catch(() => {});
      const maybeConflict = (error as { name?: string; constructor?: { name?: string } }).constructor?.name === 'ConflictException';
      if (maybeConflict) return { status: 'conflict', reason: 'appointments_service_conflict' };
      this.logger.error(`AI appointment creation failed: ${(error as Error).message}`);
      return { status: 'error', reason: 'appointment_create_failed' };
    }
  }

  private async claimAction(
    db: TenantPrismaClient,
    params: {
      actionId: number;
      allowedStatuses: string[];
      claimStatus: string;
      actorPhone: string;
      now: Date;
      payload: Record<string, unknown>;
    },
  ): Promise<{ payload: unknown } | null> {
    const updateResult = await (db as any).aIPendingAction.updateMany({
      where: {
        id: params.actionId,
        status: { in: params.allowedStatuses },
        doNotDisturb: false,
        expiresAt: { gt: params.now },
      },
      data: {
        status: params.claimStatus,
        resolvedBy: params.actorPhone,
        payload: params.payload,
      },
    });

    if (updateResult.count !== 1) return null;
    return (db as any).aIPendingAction.findUnique({ where: { id: params.actionId } });
  }

  private async releaseClaim(
    db: TenantPrismaClient,
    actionId: number,
    status: string,
    payload: unknown,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await (db as any).aIPendingAction.update({
      where: { id: actionId },
      data: {
        status,
        resolvedAt: null,
        payload: this.mergePayloadMetadata(payload, metadata),
      },
    });
  }

  private async findActiveService(db: any, serviceId: string): Promise<ServiceRecord | null> {
    return db.service.findFirst({ where: { id: serviceId, isActive: true } });
  }

  private async findAvailableSlots(
    db: any,
    params: { service: ServiceRecord; dateIso: string; limit: number; now?: Date },
  ): Promise<AvailabilitySlot[]> {
    const employees = await this.getCandidateEmployees(db, params.service.id, params.dateIso);
    if (!employees.length) return [];

    const salon = await db.salonInfo.findFirst();
    if (!salon) return [];

    const existingAppointments = await this.getExistingAppointments(
      db,
      params.dateIso,
      employees.map((employee) => employee.id),
    );

    const slots: AvailabilitySlot[] = [];
    const seenTimes = new Set<string>();
    const isToday = params.dateIso === this.riyadhTodayIso(params.now);
    const nowMinutes = isToday ? this.riyadhNowMinutes(params.now) : 0;

    for (const employee of employees) {
      const schedule = employee.employeeSchedules?.[0];
      if (!schedule || schedule.isDayOff) continue;

      const dayStart = this.timeToMinutes(schedule.startTime);
      const dayEnd = this.timeToMinutes(schedule.endTime);
      const slotDuration = Number(salon.slotDuration || 30);
      const bufferTime = Number(salon.bufferTime || 0);

      for (let minute = dayStart; minute + params.service.duration + bufferTime <= dayEnd; minute += slotDuration) {
        if (isToday && minute <= nowMinutes) continue;
        const time = this.minutesToTime(minute);
        if (seenTimes.has(time)) continue;
        if (!this.isEmployeeAvailableAt({ employee, existingAppointments, serviceDuration: params.service.duration, bufferTime, startTime: time })) {
          continue;
        }
        seenTimes.add(time);
        slots.push({ time, displayTime: this.formatTimeForCustomer(time), employeeId: employee.id });
        if (slots.length >= params.limit) return slots;
      }
    }

    return slots;
  }

  private async findAvailableEmployeeForTime(
    db: any,
    params: { service: ServiceRecord; dateIso: string; startTime: string; employeeId?: string; now?: Date },
  ): Promise<string | null> {
    if (params.dateIso === this.riyadhTodayIso(params.now) &&
      this.timeToMinutes(params.startTime) <= this.riyadhNowMinutes(params.now)) {
      return null;
    }

    const employees = await this.getCandidateEmployees(db, params.service.id, params.dateIso, params.employeeId);
    if (!employees.length) return null;
    const salon = await db.salonInfo.findFirst();
    if (!salon) return null;

    for (const employee of employees) {
      const existingAppointments = await this.getExistingAppointments(db, params.dateIso, [employee.id]);
      if (this.isEmployeeAvailableAt({
        employee,
        existingAppointments,
        serviceDuration: params.service.duration,
        bufferTime: Number(salon.bufferTime || 0),
        startTime: params.startTime,
      })) {
        return employee.id;
      }
    }

    return null;
  }

  private async getCandidateEmployees(
    db: any,
    serviceId: string,
    dateIso: string,
    employeeId?: string,
  ): Promise<EmployeeRecord[]> {
    return db.employee.findMany({
      where: {
        isActive: true,
        ...(employeeId ? { id: employeeId } : {}),
        employeeServices: { some: { serviceId } },
      },
      include: {
        employeeSchedules: { where: { dayOfWeek: this.dayOfWeek(dateIso) } },
        employeeBreaks: { where: { dayOfWeek: this.dayOfWeek(dateIso) } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  private async getExistingAppointments(
    db: any,
    dateIso: string,
    employeeIds: string[],
  ): Promise<ExistingAppointment[]> {
    return db.appointment.findMany({
      where: {
        date: this.dateToDbDate(dateIso),
        status: { notIn: ['cancelled', 'no_show'] },
        OR: [
          { employeeId: { in: employeeIds } },
          { appointmentServices: { some: { employeeId: { in: employeeIds } } } },
        ],
      },
      select: {
        employeeId: true,
        startTime: true,
        endTime: true,
        appointmentServices: { select: { employeeId: true } },
      },
    });
  }

  private isEmployeeAvailableAt(params: {
    employee: EmployeeRecord;
    existingAppointments: ExistingAppointment[];
    serviceDuration: number;
    bufferTime: number;
    startTime: string;
  }): boolean {
    const schedule = params.employee.employeeSchedules?.[0];
    if (!schedule || schedule.isDayOff) return false;

    const slotStart = this.timeToMinutes(params.startTime);
    const slotEnd = slotStart + params.serviceDuration;
    if (slotStart < this.timeToMinutes(schedule.startTime) || slotEnd + params.bufferTime > this.timeToMinutes(schedule.endTime)) {
      return false;
    }

    const overlapsBreak = (params.employee.employeeBreaks || []).some((breakTime) => {
      const breakStart = this.timeToMinutes(breakTime.startTime);
      const breakEnd = this.timeToMinutes(breakTime.endTime);
      return slotStart < breakEnd && slotEnd > breakStart;
    });
    if (overlapsBreak) return false;

    return !params.existingAppointments.some((appointment) => {
      const employees = new Set([
        appointment.employeeId || '',
        ...(appointment.appointmentServices || []).map((service) => service.employeeId),
      ]);
      if (!employees.has(params.employee.id)) return false;
      const appointmentStart = this.timeToMinutes(appointment.startTime);
      const appointmentEnd = this.timeToMinutes(appointment.endTime);
      return slotStart < appointmentEnd + params.bufferTime &&
        slotEnd > appointmentStart - params.bufferTime;
    });
  }

  private async findOrCreateClient(
    db: any,
    params: { phone: string; name: string },
  ): Promise<{ id: string }> {
    const phone = params.phone.replace(/\D/g, '');
    const lastNine = phone.slice(-9);
    const client = await db.client.findFirst({
      where: {
        deletedAt: null,
        OR: [
          { phone },
          ...(lastNine ? [{ phone: { contains: lastNine } }] : []),
        ],
      },
      orderBy: { updatedAt: 'desc' },
    });
    if (client) return client;

    return db.client.create({
      data: {
        fullName: params.name.slice(0, 100),
        phone,
        source: 'whatsapp',
      },
    });
  }

  private parseDateText(text: string, now = new Date()): ParsedDate {
    const normalized = this.normalizeArabicText(this.normalizeArabicDigits(text));
    const today = this.riyadhTodayParts(now);
    if (!normalized) return { ok: false, reason: 'ambiguous_date' };
    if (normalized.includes('اليوم')) return { ok: true, value: this.addDaysIso(today, 0) };
    if (normalized.includes('بكره') || normalized.includes('غدا')) return { ok: true, value: this.addDaysIso(today, 1) };

    const isoMatch = normalized.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
    if (isoMatch) {
      const dateIso = this.buildDateIso(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
      return dateIso ? { ok: true, value: dateIso } : { ok: false, reason: 'ambiguous_date' };
    }

    const numericMatch = normalized.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
    if (numericMatch) {
      const day = Number(numericMatch[1]);
      const month = Number(numericMatch[2]);
      let year = numericMatch[3] ? Number(numericMatch[3]) : today.year;
      if (year < 100) year += 2000;
      let dateIso = this.buildDateIso(year, month, day);
      if (!dateIso) return { ok: false, reason: 'ambiguous_date' };
      if (!numericMatch[3] && dateIso < this.addDaysIso(today, 0)) dateIso = this.buildDateIso(year + 1, month, day);
      return { ok: true, value: dateIso };
    }

    const weekday = this.weekdayFromText(normalized);
    if (weekday !== null) {
      const todayDow = this.dateToDbDate(this.addDaysIso(today, 0)).getUTCDay();
      const delta = (weekday - todayDow + 7) % 7 || 7;
      return { ok: true, value: this.addDaysIso(today, delta) };
    }

    return { ok: false, reason: 'ambiguous_date' };
  }

  private parseTimeText(text: string): ParsedTime {
    const normalized = this.normalizeArabicText(this.normalizeArabicDigits(text));
    const match = normalized.match(/\b([01]?\d|2[0-3])(?::([0-5]\d))?\s*(am|pm|ص|صباح|صباحا|م|مساء|مساءا|ظهر|الظهر|عصر|العصر|مغرب|المغرب|ليل|الليل)?\b/i);
    if (!match) return { ok: false, reason: 'ambiguous_time' };

    let hour = Number(match[1]);
    const minute = match[2] ? Number(match[2]) : 0;
    const suffix = match[3] || '';
    const morning = ['am', 'ص', 'صباح', 'صباحا'].includes(suffix);
    const evening = ['pm', 'م', 'مساء', 'مساءا', 'ظهر', 'الظهر', 'عصر', 'العصر', 'مغرب', 'المغرب', 'ليل', 'الليل'].includes(suffix);

    if (!suffix && hour >= 1 && hour <= 12 && match[1].length === 1) {
      return { ok: false, reason: 'ambiguous_time' };
    }
    if (morning && hour === 12) hour = 0;
    if (evening && hour < 12) hour += 12;
    return { ok: true, value: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}` };
  }

  private weekdayFromText(normalized: string): number | null {
    const weekdays: Array<[number, string[]]> = [
      [0, ['الاحد']],
      [1, ['الاثنين']],
      [2, ['الثلاثاء']],
      [3, ['الاربعاء']],
      [4, ['الخميس']],
      [5, ['الجمعه', 'الجمعة']],
      [6, ['السبت']],
    ];
    for (const [day, names] of weekdays) {
      if (names.some((name) => normalized.includes(this.normalizeArabicText(name)))) return day;
    }
    return null;
  }

  private riyadhTodayParts(now = new Date()): { year: number; month: number; day: number } {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: this.timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
    const get = (type: string) => Number(parts.find((part) => part.type === type)?.value || '0');
    return { year: get('year'), month: get('month'), day: get('day') };
  }

  private riyadhTodayIso(now = new Date()): string {
    return this.addDaysIso(this.riyadhTodayParts(now), 0);
  }

  private riyadhNowMinutes(now = new Date()): number {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: this.timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(now);
    const hour = Number(parts.find((part) => part.type === 'hour')?.value || '0');
    const minute = Number(parts.find((part) => part.type === 'minute')?.value || '0');
    return hour * 60 + minute;
  }

  private addDaysIso(parts: { year: number; month: number; day: number }, days: number): string {
    const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
    return date.toISOString().slice(0, 10);
  }

  private buildDateIso(year: number, month: number, day: number): string {
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return '';
    return date.toISOString().slice(0, 10);
  }

  private dayOfWeek(dateIso: string): number {
    return this.dateToDbDate(dateIso).getUTCDay();
  }

  private dateToDbDate(dateIso: string): Date {
    return new Date(`${dateIso}T00:00:00.000Z`);
  }

  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private minutesToTime(minutes: number): string {
    const hour = Math.floor(minutes / 60) % 24;
    const minute = minutes % 60;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  private formatTimeForCustomer(time: string): string {
    const [hour, minute] = time.split(':').map(Number);
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    const suffix = hour < 12 ? 'صباحًا' : hour < 15 ? 'ظهرًا' : 'مساءً';
    return `${displayHour}:${String(minute).padStart(2, '0')} ${suffix}`;
  }

  private serviceName(service: ServiceRecord): string {
    return service.nameAr || service.nameEn || 'الخدمة';
  }

  private normalizeArabicDigits(text: string): string {
    const arabicZero = '٠'.charCodeAt(0);
    const persianZero = '۰'.charCodeAt(0);
    return text.replace(/[٠-٩۰-۹]/g, (char) => {
      const code = char.charCodeAt(0);
      if (code >= arabicZero && code <= arabicZero + 9) return String(code - arabicZero);
      return String(code - persianZero);
    });
  }

  private normalizeArabicText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[أإآ]/g, 'ا')
      .replace(/[ً-ْ]/g, '')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/[^\p{L}\p{N}\s:/-]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private asObject(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  }

  private asString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private mergePayloadMetadata(payload: unknown, metadata: Record<string, unknown>): Record<string, unknown> {
    const base = this.asObject(payload);
    const existingMetadata = this.asObject(base.metadata);
    return { ...base, metadata: { ...existingMetadata, ...metadata } };
  }
}
