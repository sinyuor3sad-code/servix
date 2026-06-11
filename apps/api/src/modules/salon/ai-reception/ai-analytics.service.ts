import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CacheService } from '../../../shared/cache/cache.service';
import { PlatformPrismaClient } from '../../../shared/database/platform.client';
import { TenantClientFactory } from '../../../shared/database/tenant-client.factory';
import { WhatsAppEvolutionService } from '../whatsapp-evolution/whatsapp-evolution.service';
import { AIReceptionSettingsService } from './ai-reception-settings.service';
import type { TenantPrismaClient } from '../../../shared/types';

// ─────────────────── Types ───────────────────

export type AIModelUsed = 'nano' | 'mini' | 'gemini' | 'cached' | 'unknown';

export interface ConversationEvent {
  ts: string;
  intent: string;
  wasEscalated: boolean;
  wasBooked: boolean;
  responseTimeMs: number;
  modelUsed: AIModelUsed;
  wasVoice: boolean;
  wasCached: boolean;
  serviceName?: string | null;
  hour?: number;
  dayOfWeek?: number;
}

export interface WeeklyStats {
  totalConversations: number;
  totalBookings: number;
  conversionRate: number;
  avgResponseTimeMs: number;
  voiceMessages: number;
  escalations: number;
  cachedHits: number;
  topService: { name: string; count: number } | null;
  topTimeWindow: { label: string; count: number } | null;
  topRepeatedQuestion: { intent: string; count: number } | null;
  estimatedCostSar: number;
  windowStart: string;
  windowEnd: string;
}

const ANALYTICS_PREFIX = 'servix:ai_analytics:';
const RETENTION_SECONDS = 60 * 24 * 60 * 60;
const MAX_EVENTS_PER_BUCKET = 5000;

// Cost in SAR per million tokens (April 2026 OpenAI pricing × 3.75 USD→SAR).
// Based on plan §1.3 cost table — approximations for the weekly report only.
const COST_PER_CONVERSATION_SAR: Record<AIModelUsed, number> = {
  nano: 0.0017,
  mini: 0.0085,
  gemini: 0.0024,
  cached: 0,
  unknown: 0.002,
};

const DAY_NAMES_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

/**
 * Lightweight in-Redis analytics for AI Reception. Each conversation appends
 * an event to a per-month bucket; the weekly cron rolls them up and pings
 * the salon manager with a short report.
 */
@Injectable()
export class AIAnalyticsService {
  private readonly logger = new Logger(AIAnalyticsService.name);

  constructor(
    private readonly cache: CacheService,
    private readonly platformDb: PlatformPrismaClient,
    private readonly tenantFactory: TenantClientFactory,
    private readonly evolutionService: WhatsAppEvolutionService,
    private readonly receptionSettings: AIReceptionSettingsService,
  ) {}

  // ═══════════════════════════════════════════
  // Public API
  // ═══════════════════════════════════════════

  async trackConversation(
    tenantId: string,
    data: Omit<ConversationEvent, 'ts' | 'hour' | 'dayOfWeek'>,
  ): Promise<void> {
    const now = new Date();
    const event: ConversationEvent = {
      ...data,
      ts: now.toISOString(),
      hour: now.getHours(),
      dayOfWeek: now.getDay(),
    };

    const key = this.bucketKey(tenantId, now);
    const events = (await this.cache.getJson<ConversationEvent[]>(key)) || [];
    events.push(event);

    const trimmed = events.length > MAX_EVENTS_PER_BUCKET
      ? events.slice(-MAX_EVENTS_PER_BUCKET)
      : events;

    await this.cache.setJson(key, trimmed, RETENTION_SECONDS);
  }

  async getWeeklyStats(tenantId: string, now: Date = new Date()): Promise<WeeklyStats> {
    const events = await this.loadLast7Days(tenantId, now);
    return this.aggregate(events, now);
  }

  async buildWeeklyReport(tenantId: string, now: Date = new Date()): Promise<string> {
    const stats = await this.getWeeklyStats(tenantId, now);

    if (stats.totalConversations === 0) {
      return '📊 ملخص الأسبوع:\n- لم تكن هناك محادثات هذا الأسبوع.';
    }

    const lines: string[] = [
      '📊 ملخص الأسبوع:',
      `- ${stats.totalConversations} محادثة، ${stats.totalBookings} حجز ✅ (نسبة التحويل ${(stats.conversionRate * 100).toFixed(0)}%)`,
      `- ⏱️ متوسط وقت الرد: ${(stats.avgResponseTimeMs / 1000).toFixed(1)} ثانية`,
    ];

    if (stats.voiceMessages > 0) lines.push(`- 🎤 صوتيات: ${stats.voiceMessages}`);
    if (stats.escalations > 0) lines.push(`- ⬆️ تصعيدات: ${stats.escalations}`);
    if (stats.cachedHits > 0) lines.push(`- ⚡ ردود من الكاش: ${stats.cachedHits} (وفّرت تكلفة AI)`);
    if (stats.topService) lines.push(`- 🔝 أكثر خدمة: ${stats.topService.name} (${stats.topService.count} مرة)`);
    if (stats.topTimeWindow) lines.push(`- ⏰ أكثر وقت: ${stats.topTimeWindow.label}`);
    if (stats.topRepeatedQuestion) {
      lines.push(`- ❓ نية متكررة: ${stats.topRepeatedQuestion.intent} (${stats.topRepeatedQuestion.count} مرة)`);
    }
    lines.push(`- 💰 تكلفة AI تقديرية: ~${stats.estimatedCostSar.toFixed(2)} ريال`);

    return lines.join('\n');
  }

  // ═══════════════════════════════════════════
  // Cron — weekly report
  // ═══════════════════════════════════════════

  /** Every Sunday 09:00 (server TZ) — push the weekly report to each salon's manager. */
  @Cron('0 9 * * 0')
  async sendWeeklyReports(): Promise<void> {
    try {
      const instances = await this.platformDb.whatsAppInstance.findMany({
        where: { status: 'connected' },
        include: { tenant: { select: { id: true, databaseName: true, status: true } } },
      });

      for (const instance of instances) {
        const tenant = instance.tenant;
        if (!tenant || (tenant.status !== 'active' && tenant.status !== 'trial')) continue;

        try {
          await this.sendReportForTenant(tenant.id, tenant.databaseName, instance.instanceName, instance.instanceToken);
        } catch (err) {
          this.logger.error(`Weekly report failed for tenant ${tenant.id}: ${(err as Error).message}`);
        }
      }
    } catch (err) {
      this.logger.error(`sendWeeklyReports cron failed: ${(err as Error).message}`);
    }
  }

  private async sendReportForTenant(
    tenantId: string,
    databaseName: string,
    instanceName: string,
    instanceToken: string,
  ): Promise<void> {
    const tenantDb = this.tenantFactory.getTenantClient(databaseName) as unknown as TenantPrismaClient;
    const settings = await this.receptionSettings.get(tenantDb, tenantId);

    if (!settings.aiReceptionEnabled || !settings.aiManagerPhone) {
      this.logger.debug(`Skipping weekly report for ${tenantId} — no manager phone or AI disabled`);
      return;
    }

    const report = await this.buildWeeklyReport(tenantId);

    await this.evolutionService.sendText({
      instanceName,
      instanceToken,
      to: settings.aiManagerPhone,
      message: report,
      // non-security: report-send delay jitter (1–3s).
      delayMs: Math.floor(1000 + Math.random() * 2000),
    });

    this.logger.log(`📊 Weekly report sent to ${settings.aiManagerPhone} for tenant ${tenantId}`);
  }

  // ═══════════════════════════════════════════
  // Internals
  // ═══════════════════════════════════════════

  private bucketKey(tenantId: string, when: Date): string {
    const yyyy = when.getUTCFullYear();
    const mm = String(when.getUTCMonth() + 1).padStart(2, '0');
    return `${ANALYTICS_PREFIX}${tenantId}:${yyyy}-${mm}`;
  }

  private async loadLast7Days(tenantId: string, now: Date): Promise<ConversationEvent[]> {
    const cutoff = now.getTime() - 7 * 24 * 60 * 60 * 1000;

    // Load current month + previous month (covers any 7-day window).
    const buckets: ConversationEvent[][] = await Promise.all([
      this.cache.getJson<ConversationEvent[]>(this.bucketKey(tenantId, now)).then((v) => v || []),
      this.cache.getJson<ConversationEvent[]>(this.bucketKey(tenantId, new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000))).then((v) => v || []),
    ]);

    return buckets.flat().filter((e) => new Date(e.ts).getTime() >= cutoff);
  }

  private aggregate(events: ConversationEvent[], now: Date): WeeklyStats {
    const windowStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const windowEnd = now.toISOString();

    if (!events.length) {
      return {
        totalConversations: 0,
        totalBookings: 0,
        conversionRate: 0,
        avgResponseTimeMs: 0,
        voiceMessages: 0,
        escalations: 0,
        cachedHits: 0,
        topService: null,
        topTimeWindow: null,
        topRepeatedQuestion: null,
        estimatedCostSar: 0,
        windowStart,
        windowEnd,
      };
    }

    const totalConversations = events.length;
    const totalBookings = events.filter((e) => e.wasBooked).length;
    const totalResponseTime = events.reduce((sum, e) => sum + (e.responseTimeMs || 0), 0);
    const voiceMessages = events.filter((e) => e.wasVoice).length;
    const escalations = events.filter((e) => e.wasEscalated).length;
    const cachedHits = events.filter((e) => e.wasCached).length;
    const estimatedCostSar = events.reduce(
      (sum, e) => sum + (COST_PER_CONVERSATION_SAR[e.modelUsed] ?? 0),
      0,
    );

    const serviceCounts = this.countBy(events, (e) => e.serviceName?.trim() || null);
    const topService = this.topEntry(serviceCounts);

    const timeWindowCounts = new Map<string, number>();
    for (const e of events) {
      if (e.dayOfWeek === undefined || e.hour === undefined) continue;
      const day = DAY_NAMES_AR[e.dayOfWeek];
      const window = this.hourBand(e.hour);
      const label = `${day} ${window}`;
      timeWindowCounts.set(label, (timeWindowCounts.get(label) || 0) + 1);
    }
    const topTimeWindowEntry = this.topEntry(timeWindowCounts);

    const intentCounts = this.countBy(events, (e) => e.intent || null);
    // Drop trivial intents from "top question" pick.
    const filteredIntents = new Map<string, number>();
    for (const [intent, count] of intentCounts) {
      if (intent === 'greeting' || intent === 'general_reply') continue;
      filteredIntents.set(intent, count);
    }
    const topRepeatedQuestionEntry = this.topEntry(filteredIntents);

    return {
      totalConversations,
      totalBookings,
      conversionRate: totalConversations === 0 ? 0 : totalBookings / totalConversations,
      avgResponseTimeMs: totalConversations === 0 ? 0 : totalResponseTime / totalConversations,
      voiceMessages,
      escalations,
      cachedHits,
      topService: topService ? { name: topService[0], count: topService[1] } : null,
      topTimeWindow: topTimeWindowEntry
        ? { label: topTimeWindowEntry[0], count: topTimeWindowEntry[1] }
        : null,
      topRepeatedQuestion: topRepeatedQuestionEntry
        ? { intent: topRepeatedQuestionEntry[0], count: topRepeatedQuestionEntry[1] }
        : null,
      estimatedCostSar,
      windowStart,
      windowEnd,
    };
  }

  private countBy<T>(items: T[], pick: (item: T) => string | null): Map<string, number> {
    const counts = new Map<string, number>();
    for (const item of items) {
      const key = pick(item);
      if (!key) continue;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return counts;
  }

  private topEntry(counts: Map<string, number>): [string, number] | null {
    let best: [string, number] | null = null;
    for (const entry of counts) {
      if (!best || entry[1] > best[1]) best = entry;
    }
    return best;
  }

  private hourBand(hour: number): string {
    if (hour < 6) return 'فجراً';
    if (hour < 12) return 'صباحاً';
    if (hour < 16) return 'ظهراً';
    if (hour < 19) return 'عصراً';
    if (hour < 22) return 'مساءً';
    return 'ليلاً';
  }
}
