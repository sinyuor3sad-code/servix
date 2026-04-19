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

    // Prayer buffer check — Saudi prayer times seasonal approximation
    // Times shift by ~1.5 hours between summer/winter. Using month-based lookup.
    if (conditions.prayerBuffer === true) {
      const month = new Date().getMonth(); // 0-11
      // Seasonal prayer windows (Riyadh approximate, ±15 min buffer)
      const seasonalPrayers: Record<number, Array<{ start: string; end: string }>> = {
        // Winter (Dec-Feb): early sunset, late sunrise
        0:  [{ start:'05:30', end:'06:00' }, { start:'12:00', end:'12:30' }, { start:'15:00', end:'15:30' }, { start:'17:15', end:'17:45' }, { start:'18:45', end:'19:15' }],
        1:  [{ start:'05:20', end:'05:50' }, { start:'12:00', end:'12:30' }, { start:'15:10', end:'15:40' }, { start:'17:30', end:'18:00' }, { start:'19:00', end:'19:30' }],
        2:  [{ start:'05:00', end:'05:30' }, { start:'12:00', end:'12:30' }, { start:'15:15', end:'15:45' }, { start:'17:50', end:'18:20' }, { start:'19:15', end:'19:45' }],
        // Spring (Mar-May)
        3:  [{ start:'04:40', end:'05:10' }, { start:'11:50', end:'12:20' }, { start:'15:15', end:'15:45' }, { start:'18:10', end:'18:40' }, { start:'19:30', end:'20:00' }],
        4:  [{ start:'04:10', end:'04:40' }, { start:'11:45', end:'12:15' }, { start:'15:15', end:'15:45' }, { start:'18:30', end:'19:00' }, { start:'20:00', end:'20:30' }],
        5:  [{ start:'03:50', end:'04:20' }, { start:'11:45', end:'12:15' }, { start:'15:15', end:'15:45' }, { start:'18:50', end:'19:20' }, { start:'20:15', end:'20:45' }],
        // Summer (Jun-Aug): late sunset, early sunrise
        6:  [{ start:'03:45', end:'04:15' }, { start:'11:50', end:'12:20' }, { start:'15:20', end:'15:50' }, { start:'18:55', end:'19:25' }, { start:'20:20', end:'20:50' }],
        7:  [{ start:'04:00', end:'04:30' }, { start:'11:50', end:'12:20' }, { start:'15:15', end:'15:45' }, { start:'18:40', end:'19:10' }, { start:'20:10', end:'20:40' }],
        8:  [{ start:'04:20', end:'04:50' }, { start:'11:45', end:'12:15' }, { start:'15:10', end:'15:40' }, { start:'18:10', end:'18:40' }, { start:'19:40', end:'20:10' }],
        // Autumn (Sep-Nov)
        9:  [{ start:'04:35', end:'05:05' }, { start:'11:40', end:'12:10' }, { start:'15:00', end:'15:30' }, { start:'17:40', end:'18:10' }, { start:'19:10', end:'19:40' }],
        10: [{ start:'04:55', end:'05:25' }, { start:'11:40', end:'12:10' }, { start:'14:50', end:'15:20' }, { start:'17:15', end:'17:45' }, { start:'18:45', end:'19:15' }],
        11: [{ start:'05:20', end:'05:50' }, { start:'11:50', end:'12:20' }, { start:'14:50', end:'15:20' }, { start:'17:05', end:'17:35' }, { start:'18:35', end:'19:05' }],
      };

      const prayerWindows = (seasonalPrayers[month] || seasonalPrayers[0]).map(w => ({
        start: timeToMinutes(w.start),
        end: timeToMinutes(w.end),
      }));

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
