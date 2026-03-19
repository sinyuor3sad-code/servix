import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PlatformPrismaClient } from '../../../shared/database/platform.client';
import { TenantClientFactory } from '../../../shared/database/tenant-client.factory';
import { TenantPrismaClient } from '../../../shared/types';
import { CacheService } from '../../../shared/cache/cache.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { SlotsQueryDto } from './dto/slots-query.dto';
import { SettingsService } from '../settings/settings.service';
import { SETTINGS_KEYS } from '../settings/settings.constants';

@Injectable()
export class BookingService {
  constructor(
    private readonly platformDb: PlatformPrismaClient,
    private readonly tenantFactory: TenantClientFactory,
    private readonly settingsService: SettingsService,
    private readonly cacheService: CacheService,
  ) {}

  private async getTenantDb(slug: string): Promise<TenantPrismaClient> {
    const tenant = await this.platformDb.tenant.findUnique({
      where: { slug },
    });

    if (!tenant || tenant.status === 'cancelled') {
      throw new NotFoundException('الصالون غير موجود');
    }

    if (tenant.status === 'suspended') {
      throw new BadRequestException('الصالون متوقف مؤقتاً');
    }

    return this.tenantFactory.getTenantClient(
      tenant.databaseName,
    ) as unknown as TenantPrismaClient;
  }

  async getSalonInfo(
    slug: string,
  ): Promise<Record<string, unknown>> {
    const tenant = await this.platformDb.tenant.findUnique({
      where: { slug },
      select: {
        nameAr: true,
        nameEn: true,
        slug: true,
        logoUrl: true,
        primaryColor: true,
        theme: true,
      },
    });

    if (!tenant) {
      throw new NotFoundException('الصالون غير موجود');
    }

    const db = await this.getTenantDb(slug);
    const salonInfo = await db.salonInfo.findFirst();
    const settings = await this.settingsService.getForSlug(slug);

    return {
      ...tenant,
      salonInfo,
      settings: {
        onlineBookingEnabled: settings[SETTINGS_KEYS.online_booking_enabled] === 'true',
        vacationMode: settings[SETTINGS_KEYS.vacation_mode] === 'true',
        vacationMessageAr: settings[SETTINGS_KEYS.vacation_message_ar] || undefined,
      },
    };
  }

  async getServices(
    slug: string,
  ): Promise<Record<string, unknown>[]> {
    const db = await this.getTenantDb(slug);

    const categories = await db.serviceCategory.findMany({
      where: { isActive: true },
      include: {
        services: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    return categories.map((cat) => ({
      ...cat,
      services: cat.services.map((s) => ({
        ...s,
        price: Number(s.price),
        imageUrl: s.imageUrl ?? null,
      })),
    }));
  }

  async getEmployees(
    slug: string,
  ): Promise<Record<string, unknown>[]> {
    const db = await this.getTenantDb(slug);

    const employees = await db.employee.findMany({
      where: { isActive: true },
      select: {
        id: true,
        fullName: true,
        role: true,
        avatarUrl: true,
        employeeServices: {
          include: {
            service: {
              select: { id: true, nameAr: true, nameEn: true },
            },
          },
        },
      },
    });

    return employees.map((emp) => ({
      id: emp.id,
      fullName: emp.fullName,
      role: emp.role,
      avatarUrl: emp.avatarUrl,
      services: emp.employeeServices.map((es) => es.service),
    }));
  }

  async getAvailableSlots(
    slug: string,
    query: SlotsQueryDto,
  ): Promise<string[]> {
    const settings = await this.settingsService.getForSlug(slug);
    if (settings[SETTINGS_KEYS.online_booking_enabled] !== 'true') {
      return [];
    }
    if (settings[SETTINGS_KEYS.vacation_mode] === 'true') {
      return [];
    }

    const db = await this.getTenantDb(slug);
    const salonInfo = await db.salonInfo.findFirst();

    if (!salonInfo) {
      throw new NotFoundException('معلومات الصالون غير متوفرة');
    }

    const services = await db.service.findMany({
      where: { id: { in: query.serviceIds }, isActive: true },
    });

    if (services.length !== query.serviceIds.length) {
      throw new BadRequestException('بعض الخدمات غير متوفرة');
    }

    const totalDuration = services.reduce((sum, s) => sum + s.duration, 0);
    const requestedDate = new Date(query.date);

    const employeeWhere: Record<string, unknown> = { isActive: true };
    if (query.employeeId) {
      employeeWhere.id = query.employeeId;
    }

    const employees = await db.employee.findMany({
      where: employeeWhere,
      include: {
        employeeSchedules: {
          where: { dayOfWeek: requestedDate.getDay() },
        },
        employeeBreaks: {
          where: { dayOfWeek: requestedDate.getDay() },
        },
      },
    });

    const existingAppointments = await db.appointment.findMany({
      where: {
        date: requestedDate,
        status: { notIn: ['cancelled', 'no_show'] },
        ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      },
      select: { employeeId: true, startTime: true, endTime: true },
    });

    const today = new Date();
    const isToday =
      requestedDate.getFullYear() === today.getFullYear() &&
      requestedDate.getMonth() === today.getMonth() &&
      requestedDate.getDate() === today.getDate();

    let attendanceFilter: Set<string> | null = null;
    if (isToday) {
      const todayAttendance = await db.attendance.findMany({
        where: { date: requestedDate },
        select: { employeeId: true, checkIn: true, checkOut: true, isOnBreak: true },
      });
      attendanceFilter = new Set(
        todayAttendance
          .filter((a) => a.checkIn && !a.checkOut && !a.isOnBreak)
          .map((a) => a.employeeId),
      );
    }

    const slotDuration = salonInfo.slotDuration;
    const bufferTime = salonInfo.bufferTime;
    const availableSlots = new Set<string>();

    for (const employee of employees) {
      const schedule = employee.employeeSchedules[0];
      if (!schedule || schedule.isDayOff) continue;

      if (attendanceFilter && !attendanceFilter.has(employee.id)) continue;

      const dayStart = this.timeToMinutes(schedule.startTime);
      const dayEnd = this.timeToMinutes(schedule.endTime);

      const breaks = employee.employeeBreaks.map((b) => ({
        start: this.timeToMinutes(b.startTime),
        end: this.timeToMinutes(b.endTime),
      }));

      const empAppointments = existingAppointments
        .filter((a) => a.employeeId === employee.id)
        .map((a) => ({
          start: this.timeToMinutes(a.startTime),
          end: this.timeToMinutes(a.endTime),
        }));

      for (
        let time = dayStart;
        time + totalDuration + bufferTime <= dayEnd;
        time += slotDuration
      ) {
        const slotEnd = time + totalDuration;

        const conflictsWithBreak = breaks.some(
          (b) => time < b.end && slotEnd > b.start,
        );
        if (conflictsWithBreak) continue;

        const conflictsWithAppointment = empAppointments.some(
          (a) => time < a.end + bufferTime && slotEnd > a.start - bufferTime,
        );
        if (conflictsWithAppointment) continue;

        availableSlots.add(this.minutesToTime(time));
      }
    }

    return Array.from(availableSlots).sort();
  }

  async createBooking(
    slug: string,
    dto: CreateBookingDto,
  ): Promise<Record<string, unknown>> {
    const settings = await this.settingsService.getForSlug(slug);
    if (settings[SETTINGS_KEYS.online_booking_enabled] !== 'true') {
      throw new BadRequestException('الحجز الإلكتروني مغلق حالياً');
    }
    if (settings[SETTINGS_KEYS.vacation_mode] === 'true') {
      const msg = settings[SETTINGS_KEYS.vacation_message_ar] || 'الصالون في إجازة';
      throw new BadRequestException(msg);
    }

    const db = await this.getTenantDb(slug);

    const services = await db.service.findMany({
      where: { id: { in: dto.serviceIds }, isActive: true },
    });

    if (services.length !== dto.serviceIds.length) {
      throw new BadRequestException('بعض الخدمات غير متوفرة');
    }

    const totalDuration = services.reduce((sum, s) => sum + s.duration, 0);
    const totalPrice = services.reduce((sum, s) => sum + Number(s.price), 0);

    const startMinutes = this.timeToMinutes(dto.startTime);
    const endTime = this.minutesToTime(startMinutes + totalDuration);

    let client = await db.client.findFirst({
      where: { phone: dto.clientPhone, deletedAt: null },
    });

    if (!client) {
      client = await db.client.create({
        data: {
          fullName: dto.clientName,
          phone: dto.clientPhone,
          source: 'online',
        },
      });
    }

    let assignedEmployeeId = dto.employeeId;

    if (!assignedEmployeeId) {
      const availableEmployee = await db.employee.findFirst({
        where: {
          isActive: true,
          employeeServices: {
            some: { serviceId: { in: dto.serviceIds } },
          },
        },
      });
      assignedEmployeeId = availableEmployee?.id;
    }

    const appointment = await db.appointment.create({
      data: {
        clientId: client.id,
        employeeId: assignedEmployeeId,
        date: new Date(dto.date),
        startTime: dto.startTime,
        endTime,
        status: 'pending',
        source: 'online',
        notes: dto.notes,
        totalPrice,
        totalDuration,
        appointmentServices: {
          create: services.map((service) => ({
            serviceId: service.id,
            employeeId: assignedEmployeeId ?? client!.id,
            price: service.price,
            duration: service.duration,
          })),
        },
      },
      include: {
        client: { select: { id: true, fullName: true, phone: true } },
        employee: { select: { id: true, fullName: true } },
        appointmentServices: {
          include: {
            service: { select: { id: true, nameAr: true, nameEn: true, price: true, duration: true } },
          },
        },
      },
    });

    return {
      ...appointment,
      totalPrice: Number(appointment.totalPrice),
    };
  }

  async sendOtp(
    phone: string,
  ): Promise<{ message: string }> {
    const canSend = await this.cacheService.canSendBookingOtp(phone);
    if (!canSend) {
      throw new BadRequestException('يرجى الانتظار قبل إرسال رمز جديد');
    }

    const code = String(Math.floor(1000 + Math.random() * 9000));
    await this.cacheService.setBookingOtp(phone, code);
    await this.cacheService.markBookingOtpSent(phone);

    // TODO: send SMS via WhatsApp/SMS gateway
    // For now, log to console in development
    console.log(`[BookingOTP] Phone: ${phone}, Code: ${code}`);

    return { message: 'تم إرسال رمز التحقق' };
  }

  async verifyOtp(
    phone: string,
    code: string,
  ): Promise<{ verified: boolean }> {
    const verified = await this.cacheService.verifyBookingOtp(phone, code);
    return { verified };
  }

  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private minutesToTime(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
}
