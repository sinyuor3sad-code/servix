import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import type { Campaign } from '../../../../generated/tenant';
import { TenantPrismaClient } from '@shared/types';
import { CreateCampaignDto, UpdateCampaignDto } from './dto/create-campaign.dto';

export type CalendarGap = {
  date: string;
  startTime: string;
  endTime: string;
  employeeId?: string;
};

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

@Injectable()
export class MarketingService {
  private readonly logger = new Logger(MarketingService.name);

  async listCampaigns(db: TenantPrismaClient): Promise<Campaign[]> {
    return db.campaign.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async createCampaign(
    db: TenantPrismaClient,
    dto: CreateCampaignDto,
  ): Promise<Campaign> {
    return db.campaign.create({
      data: {
        nameAr: dto.nameAr,
        trigger: dto.trigger,
        messageAr: dto.messageAr,
        channel: dto.channel ?? 'whatsapp',
        targetFilter: dto.targetFilter as unknown as import('../../../../generated/tenant').Prisma.InputJsonValue | undefined,
        couponId: dto.couponId,
        requiresSlotAvailability: dto.requiresSlotAvailability ?? true,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
      },
    });
  }

  async updateCampaign(
    db: TenantPrismaClient,
    id: string,
    dto: UpdateCampaignDto,
  ): Promise<Campaign> {
    const existing = await db.campaign.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('الحملة غير موجودة');
    }

    const data: Record<string, unknown> = {};
    if (dto.nameAr !== undefined) data.nameAr = dto.nameAr;
    if (dto.trigger !== undefined) data.trigger = dto.trigger;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.messageAr !== undefined) data.messageAr = dto.messageAr;
    if (dto.channel !== undefined) data.channel = dto.channel;
    if (dto.targetFilter !== undefined) data.targetFilter = dto.targetFilter;
    if (dto.couponId !== undefined) data.couponId = dto.couponId;
    if (dto.requiresSlotAvailability !== undefined) {
      data.requiresSlotAvailability = dto.requiresSlotAvailability;
    }
    if (dto.scheduledAt !== undefined) {
      data.scheduledAt = new Date(dto.scheduledAt);
    }

    return db.campaign.update({ where: { id }, data });
  }

  /**
   * Execute a campaign: identify target clients, send notifications, update stats.
   */
  async executeCampaign(
    db: TenantPrismaClient,
    id: string,
  ): Promise<{ sent: number }> {
    const campaign = await db.campaign.findUnique({ where: { id } });
    if (!campaign) {
      throw new NotFoundException('الحملة غير موجودة');
    }

    // Build client query based on targetFilter
    const clientWhere: Record<string, unknown> = {
      isActive: true,
      deletedAt: null,
    };

    const filter = campaign.targetFilter as Record<string, unknown> | null;
    if (filter) {
      // Churn risk targeting
      if (filter.churnRisk) {
        clientWhere.dna = { churnRisk: filter.churnRisk };
      }
      // VIP targeting
      if (filter.isVip !== undefined) {
        clientWhere.dna = { ...(clientWhere.dna as object || {}), isVip: filter.isVip };
      }
      // Source targeting
      if (filter.source) {
        clientWhere.source = filter.source;
      }
    }

    // Check slot availability if required
    let hasAvailableSlots = true;
    if (campaign.requiresSlotAvailability) {
      const gaps = await this.detectCalendarGaps(db);
      hasAvailableSlots = gaps.length > 0;
    }

    if (!hasAvailableSlots) {
      this.logger.warn(`Campaign ${id} skipped — no available slots`);
      return { sent: 0 };
    }

    const clients = await db.client.findMany({
      where: clientWhere,
      select: { id: true, fullName: true },
    });

    let sent = 0;
    for (const client of clients) {
      await db.notification.create({
        data: {
          recipientType: 'client',
          recipientId: client.id,
          titleAr: campaign.nameAr,
          bodyAr: campaign.messageAr,
          type: 'marketing',
          channel: campaign.channel,
          data: {
            campaignId: id,
            couponId: campaign.couponId,
          },
        },
      });
      sent++;
    }

    // Update campaign stats
    await db.campaign.update({
      where: { id },
      data: {
        sentCount: sent,
        executedAt: new Date(),
        status: 'completed',
      },
    });

    this.logger.log(`Campaign ${id} executed: ${sent} messages sent`);
    return { sent };
  }

  /**
   * Detect gaps in the calendar for the next 7 days.
   * A gap is a continuous empty slot > 60 minutes between shifts/appointments.
   */
  async detectCalendarGaps(db: TenantPrismaClient): Promise<CalendarGap[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    const shifts = await db.shift.findMany({
      where: {
        date: { gte: today, lte: nextWeek },
        status: { in: ['scheduled', 'active'] },
      },
      include: { employee: true },
    });

    const gaps: CalendarGap[] = [];

    for (const shift of shifts) {
      const dateStr = new Date(shift.date).toISOString().split('T')[0];

      // Get appointments for this employee on this date
      const appointments = await db.appointment.findMany({
        where: {
          date: shift.date,
          employeeId: shift.employeeId,
          status: { notIn: ['cancelled', 'no_show'] },
        },
        orderBy: { startTime: 'asc' },
        select: { startTime: true, endTime: true },
      });

      // Find gaps between appointments within the shift window
      const shiftStart = timeToMinutes(shift.startTime);
      const shiftEnd = timeToMinutes(shift.endTime);

      const busySlots = appointments.map((a) => ({
        start: timeToMinutes(a.startTime),
        end: timeToMinutes(a.endTime),
      }));

      // Sort busy slots by start time
      busySlots.sort((a, b) => a.start - b.start);

      let cursor = shiftStart;
      for (const slot of busySlots) {
        if (slot.start > cursor) {
          const gapMinutes = slot.start - cursor;
          if (gapMinutes >= 60) {
            gaps.push({
              date: dateStr,
              startTime: minutesToTime(cursor),
              endTime: minutesToTime(slot.start),
              employeeId: shift.employeeId,
            });
          }
        }
        cursor = Math.max(cursor, slot.end);
      }

      // Check gap at end of shift
      if (shiftEnd > cursor) {
        const gapMinutes = shiftEnd - cursor;
        if (gapMinutes >= 60) {
          gaps.push({
            date: dateStr,
            startTime: minutesToTime(cursor),
            endTime: minutesToTime(shiftEnd),
            employeeId: shift.employeeId,
          });
        }
      }
    }

    return gaps;
  }
}
