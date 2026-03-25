import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import type { PricingRule } from '../../../../generated/tenant';
import { TenantPrismaClient } from '@shared/types';
import {
  CreatePricingRuleDto,
  UpdatePricingRuleDto,
} from './dto/create-rule.dto';

export type CalculatedPriceResult = {
  basePrice: number;
  effectivePrice: number;
  appliedRuleIds: string[];
};

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

@Injectable()
export class DynamicPricingService {
  private readonly logger = new Logger(DynamicPricingService.name);

  async listRules(db: TenantPrismaClient): Promise<PricingRule[]> {
    return db.pricingRule.findMany({
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      include: { service: { select: { id: true, nameAr: true } } },
    });
  }

  async createRule(
    db: TenantPrismaClient,
    dto: CreatePricingRuleDto,
  ): Promise<PricingRule> {
    return db.pricingRule.create({
      data: {
        serviceId: dto.serviceId,
        ruleType: dto.ruleType,
        nameAr: dto.nameAr,
        multiplier: dto.multiplier ?? 1.0,
        fixedAdjustment: dto.fixedAdjustment ?? 0,
        conditions: dto.conditions as unknown as import('../../../../generated/tenant').Prisma.InputJsonValue,
        priority: dto.priority ?? 0,
        isActive: dto.isActive ?? true,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : undefined,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
      },
    });
  }

  async updateRule(
    db: TenantPrismaClient,
    id: string,
    dto: UpdatePricingRuleDto,
  ): Promise<PricingRule> {
    const existing = await db.pricingRule.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('قاعدة التسعير غير موجودة');
    }

    const data: Record<string, unknown> = {};
    if (dto.serviceId !== undefined) data.serviceId = dto.serviceId;
    if (dto.ruleType !== undefined) data.ruleType = dto.ruleType;
    if (dto.nameAr !== undefined) data.nameAr = dto.nameAr;
    if (dto.multiplier !== undefined) data.multiplier = dto.multiplier;
    if (dto.fixedAdjustment !== undefined) data.fixedAdjustment = dto.fixedAdjustment;
    if (dto.conditions !== undefined) data.conditions = dto.conditions;
    if (dto.priority !== undefined) data.priority = dto.priority;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.validFrom !== undefined) data.validFrom = new Date(dto.validFrom);
    if (dto.validUntil !== undefined) data.validUntil = new Date(dto.validUntil);

    return db.pricingRule.update({ where: { id }, data });
  }

  /**
   * Calculate the effective price for a service at a given date/time.
   * Evaluates all matching rules by priority:
   *  - Multipliers are multiplied together (compound)
   *  - Fixed adjustments are summed
   *
   * Rule conditions format:
   *  { startTime: "14:00", endTime: "18:00" }  — peak hours
   *  { days: [5, 6] }                           — weekends (Fri/Sat)
   *  { prayerBuffer: true }                     — within prayer buffer
   */
  async calculateEffectivePrice(
    db: TenantPrismaClient,
    serviceId: string,
    date: string,
    time: string,
  ): Promise<CalculatedPriceResult> {
    const service = await db.service.findUnique({ where: { id: serviceId } });
    if (!service) {
      throw new NotFoundException('الخدمة غير موجودة');
    }

    const basePrice = Number(service.price);
    const targetDate = new Date(date);
    const dayOfWeek = targetDate.getDay();
    const timeMinutes = timeToMinutes(time);
    const now = new Date();

    // Load all active rules that apply to this service or globally
    const rules = await db.pricingRule.findMany({
      where: {
        isActive: true,
        OR: [
          { serviceId },
          { serviceId: null }, // Global rules
        ],
        AND: [
          { OR: [{ validFrom: null }, { validFrom: { lte: now } }] },
          { OR: [{ validUntil: null }, { validUntil: { gte: now } }] },
        ],
      },
      orderBy: { priority: 'desc' },
    });

    let compoundMultiplier = 1.0;
    let totalFixedAdjustment = 0;
    const appliedRuleIds: string[] = [];

    for (const rule of rules) {
      const conditions = rule.conditions as Record<string, unknown>;
      if (!this.evaluateConditions(conditions, dayOfWeek, timeMinutes)) {
        continue;
      }

      compoundMultiplier *= Number(rule.multiplier);
      totalFixedAdjustment += Number(rule.fixedAdjustment);
      appliedRuleIds.push(rule.id);
    }

    const effectivePrice = Math.max(
      0,
      Math.round((basePrice * compoundMultiplier + totalFixedAdjustment) * 100) / 100,
    );

    return { basePrice, effectivePrice, appliedRuleIds };
  }

  /**
   * Evaluate rule conditions against current date/time context.
   */
  private evaluateConditions(
    conditions: Record<string, unknown>,
    dayOfWeek: number,
    timeMinutes: number,
  ): boolean {
    // Time window check
    if (conditions.startTime && conditions.endTime) {
      const ruleStart = timeToMinutes(conditions.startTime as string);
      const ruleEnd = timeToMinutes(conditions.endTime as string);
      if (timeMinutes < ruleStart || timeMinutes >= ruleEnd) {
        return false;
      }
    }

    // Day-of-week check
    if (conditions.days && Array.isArray(conditions.days)) {
      if (!(conditions.days as number[]).includes(dayOfWeek)) {
        return false;
      }
    }

    // Prayer buffer check — Saudi prayer times approximate
    if (conditions.prayerBuffer === true) {
      const prayerWindows = [
        { start: timeToMinutes('05:00'), end: timeToMinutes('05:30') }, // Fajr
        { start: timeToMinutes('12:00'), end: timeToMinutes('12:30') }, // Dhuhr
        { start: timeToMinutes('15:15'), end: timeToMinutes('15:45') }, // Asr
        { start: timeToMinutes('18:00'), end: timeToMinutes('18:30') }, // Maghrib
        { start: timeToMinutes('19:30'), end: timeToMinutes('20:00') }, // Isha
      ];

      const inPrayerWindow = prayerWindows.some(
        (w) => timeMinutes >= w.start && timeMinutes < w.end,
      );
      if (!inPrayerWindow) {
        return false;
      }
    }

    return true;
  }
}
