import { Injectable, Logger } from '@nestjs/common';
import type { TenantPrismaClient } from '../../../shared/types';
import { CacheService } from '../../../shared/cache/cache.service';
import { SettingsService } from '../settings/settings.service';
import { SETTINGS_KEYS } from '../settings/settings.constants';

export interface AntiBanCheckInput {
  tenantId: string;
  tenantDb: TenantPrismaClient;
  phone: string;
  /** true when sending a marketing/campaign message (subject to opt-out + hours) */
  isMarketing?: boolean;
}

export interface AntiBanDecision {
  allowed: boolean;
  reason?: string;
  /** randomized delay the caller should apply before send (ms) */
  delayMs: number;
}

@Injectable()
export class WhatsAppAntiBanService {
  private readonly logger = new Logger(WhatsAppAntiBanService.name);

  constructor(
    private readonly cache: CacheService,
    private readonly settings: SettingsService,
  ) {}

  async check(input: AntiBanCheckInput): Promise<AntiBanDecision> {
    const phone = this.normalizePhone(input.phone);
    const settings = await this.settings.getAll(input.tenantDb);

    // 1) Opt-out list — hard block regardless of message kind
    const isOptedOut = await input.tenantDb.whatsAppOptOut.findUnique({ where: { phone } });
    if (isOptedOut) {
      return { allowed: false, reason: 'recipient_opted_out', delayMs: 0 };
    }

    // 2) Marketing-specific gates (business hours + global marketing flag)
    if (input.isMarketing) {
      if (settings[SETTINGS_KEYS.whatsapp_marketing_enabled] !== 'true') {
        return { allowed: false, reason: 'marketing_disabled', delayMs: 0 };
      }
      if (settings[SETTINGS_KEYS.whatsapp_business_hours_enabled] === 'true') {
        const start = settings[SETTINGS_KEYS.whatsapp_business_hours_start] || '09:00';
        const end = settings[SETTINGS_KEYS.whatsapp_business_hours_end] || '22:00';
        if (!this.withinHours(start, end)) {
          return { allowed: false, reason: 'outside_business_hours', delayMs: 0 };
        }
      }
    }

    // 3) Per-tenant hourly rate limit (any message kind)
    const limit = parseInt(settings[SETTINGS_KEYS.whatsapp_rate_limit_per_hour] || '30', 10);
    if (limit > 0) {
      const key = `servix:wa_evo_rate:${input.tenantId}`;
      const count = await this.cache.incrementRateLimit(key, 3600);
      if (count > limit) {
        return { allowed: false, reason: 'rate_limit_exceeded', delayMs: 0 };
      }
    }

    // 4) Randomized human-like delay
    const min = parseInt(settings[SETTINGS_KEYS.whatsapp_random_delay_min_ms] || '1500', 10);
    const max = parseInt(settings[SETTINGS_KEYS.whatsapp_random_delay_max_ms] || '4500', 10);
    const delayMs = this.randomBetween(Math.max(0, min), Math.max(min, max));

    return { allowed: true, delayMs };
  }

  async addOptOut(tenantDb: TenantPrismaClient, phone: string, reason?: string): Promise<void> {
    const normalized = this.normalizePhone(phone);
    await tenantDb.whatsAppOptOut.upsert({
      where: { phone: normalized },
      create: { phone: normalized, reason: reason?.slice(0, 200) ?? null },
      update: { reason: reason?.slice(0, 200) ?? null },
    });
    this.logger.log(`Opt-out recorded: ${normalized}`);
  }

  async removeOptOut(tenantDb: TenantPrismaClient, phone: string): Promise<void> {
    const normalized = this.normalizePhone(phone);
    await tenantDb.whatsAppOptOut.deleteMany({ where: { phone: normalized } });
  }

  async listOptOuts(tenantDb: TenantPrismaClient): Promise<Array<{ phone: string; reason: string | null; optedOutAt: Date }>> {
    return tenantDb.whatsAppOptOut.findMany({
      orderBy: { optedOutAt: 'desc' },
      select: { phone: true, reason: true, optedOutAt: true },
    });
  }

  /**
   * Heuristic opt-out keyword detection (used from webhook handler).
   * Matches common Arabic + English stop phrases.
   */
  isOptOutKeyword(text: string): boolean {
    const t = text.trim().toLowerCase();
    if (!t) return false;
    const keywords = [
      'stop', 'unsubscribe', 'cancel',
      'الغاء', 'إلغاء', 'توقف', 'ايقاف', 'إيقاف', 'الغ',
      'لا تراسلوني', 'لا ترسلوا', 'لا تزعجوني',
    ];
    return keywords.some((k) => t === k || t.startsWith(k));
  }

  // ───────── Helpers ─────────

  private normalizePhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('966')) return digits;
    if (digits.startsWith('0')) return '966' + digits.slice(1);
    return '966' + digits;
  }

  private withinHours(startHHmm: string, endHHmm: string): boolean {
    // Compare in Asia/Riyadh timezone (UTC+3) — Saudi-specific
    const now = new Date();
    const riyadhOffsetMinutes = 3 * 60;
    const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
    const riyadhMinutes = (utcMinutes + riyadhOffsetMinutes) % (24 * 60);
    const [sh, sm] = startHHmm.split(':').map((n) => parseInt(n, 10));
    const [eh, em] = endHHmm.split(':').map((n) => parseInt(n, 10));
    const startMin = (sh || 0) * 60 + (sm || 0);
    const endMin = (eh || 0) * 60 + (em || 0);
    if (startMin <= endMin) {
      return riyadhMinutes >= startMin && riyadhMinutes < endMin;
    }
    // Wraps midnight
    return riyadhMinutes >= startMin || riyadhMinutes < endMin;
  }

  private randomBetween(min: number, max: number): number {
    if (max <= min) return min;
    return Math.floor(min + Math.random() * (max - min));
  }
}
