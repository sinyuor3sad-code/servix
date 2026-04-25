import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PlatformPrismaClient } from '../../../shared/database/platform.client';
import { TenantClientFactory } from '../../../shared/database/tenant-client.factory';
import type { TenantPrismaClient } from '../../../shared/types';
import { SettingsService } from '../settings/settings.service';
import { SETTINGS_KEYS } from '../settings/settings.constants';
import { WhatsAppAntiBanService } from './whatsapp-anti-ban.service';
import { WhatsAppEvolutionService } from './whatsapp-evolution.service';

interface ReviewSettings {
  enabled: boolean;
  delayMinutes: number;
  googleReviewUrl: string;
  lowRatingThreshold: number;
  highRatingThreshold: number;
  requestMessage: string;
  lowRatingResponseMessage: string;
  highRatingResponseMessage: string;
  managerPhone: string;
}

interface ClaimedReviewRequest {
  id: string;
  appointmentId: string | null;
  invoiceId: string | null;
  customerPhone: string;
  customerName: string | null;
}

interface ReviewRequestRecord extends ClaimedReviewRequest {
  status: string;
  rating?: number | null;
  respondedAt?: Date | null;
  feedbackText?: string | null;
}

@Injectable()
export class ReviewRequestsService {
  private readonly logger = new Logger(ReviewRequestsService.name);
  private static readonly BATCH_SIZE = 50;
  private static readonly RESPONSE_TTL_DAYS = 7;

  constructor(
    private readonly platformDb: PlatformPrismaClient,
    private readonly tenantFactory: TenantClientFactory,
    private readonly settingsService: SettingsService,
    private readonly antiBan: WhatsAppAntiBanService,
    private readonly evolutionService: WhatsAppEvolutionService,
  ) {}

  async scheduleForPaidInvoice(
    tenantDb: TenantPrismaClient,
    invoiceId: string,
  ): Promise<{ status: string; requestId?: string }> {
    const settings = await this.getSettings(tenantDb);
    if (!settings.enabled) return { status: 'disabled' };

    const invoice = await (tenantDb as any).invoice.findUnique({
      where: { id: invoiceId },
      include: {
        client: { select: { id: true, fullName: true, phone: true } },
        appointment: { select: { id: true, status: true } },
      },
    });

    if (!invoice || invoice.status !== 'paid') return { status: 'not_paid' };
    if (!invoice.client?.phone) return { status: 'missing_phone' };
    if (invoice.appointment && ['cancelled', 'no_show'].includes(invoice.appointment.status)) {
      return { status: 'ineligible_appointment' };
    }
    if (invoice.appointment && invoice.appointment.status !== 'completed') {
      return { status: 'deferred_until_appointment_completed' };
    }

    const request = await this.createReviewRequest(tenantDb, {
      invoiceId: invoice.id,
      appointmentId: invoice.appointmentId ?? null,
      customerPhone: invoice.client.phone,
      customerName: invoice.client.fullName ?? null,
      source: 'invoice',
      baseDate: invoice.paidAt ?? new Date(),
      settings,
    });

    return { status: 'scheduled', requestId: request.id };
  }

  async handleIncomingRating(input: {
    tenantDb: TenantPrismaClient;
    instanceName: string;
    instanceToken: string;
    phone: string;
    text: string;
  }): Promise<boolean> {
    const phone = this.normalizePhone(input.phone);
    const settings = await this.getSettings(input.tenantDb);
    const now = new Date();

    const active = await (input.tenantDb as any).reviewRequest.findFirst({
      where: {
        customerPhone: phone,
        status: 'sent',
        expiresAt: { gt: now },
      },
      orderBy: { requestSentAt: 'desc' },
    }) as ReviewRequestRecord | null;

    if (!active) {
      const captured = await this.captureLowRatingComment(
        input.tenantDb,
        phone,
        input.text,
        settings.lowRatingThreshold,
      );
      if (captured) {
        await this.sendText(input.instanceName, input.instanceToken, phone, 'تم استلام ملاحظتك، وشكرًا لتوضيحك.');
      }
      return captured;
    }

    const rating = this.parseRating(input.text);
    if (!rating) {
      await this.sendText(input.instanceName, input.instanceToken, phone, 'فضلاً أرسل رقمًا من 1 إلى 5 لتقييم تجربتك.');
      return true;
    }

    if (rating <= settings.lowRatingThreshold) {
      await this.handleLowRating(input, active, rating, settings);
      return true;
    }

    if (rating >= settings.highRatingThreshold) {
      await this.handleHighRating(input, active, rating, settings);
      return true;
    }

    await this.handleMediumRating(input, active, rating);
    return true;
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async processDueRequests(): Promise<void> {
    try {
      const instances = await this.platformDb.whatsAppInstance.findMany({
        where: { status: 'connected' },
        include: {
          tenant: { select: { id: true, databaseName: true, status: true } },
        },
      });

      for (const instance of instances) {
        if (!instance.tenant || !['active', 'trial'].includes(instance.tenant.status)) continue;
        const tenantDb = this.tenantFactory.getTenantClient(instance.tenant.databaseName) as unknown as TenantPrismaClient;

        try {
          await this.processDueForTenant({
            tenantDb,
            tenantId: instance.tenant.id,
            instanceName: instance.instanceName,
            instanceToken: instance.instanceToken,
          });
        } catch (err) {
          this.logger.error(`Review processing failed for tenant ${instance.tenant.id}: ${(err as Error).message}`);
        }
      }
    } catch (err) {
      this.logger.error(`Review cron failed: ${(err as Error).message}`);
    }
  }

  async processDueForTenant(input: {
    tenantDb: TenantPrismaClient;
    tenantId: string;
    instanceName: string;
    instanceToken: string;
  }): Promise<number> {
    const settings = await this.getSettings(input.tenantDb);
    if (!settings.enabled) return 0;

    await this.scheduleMissingPaidInvoices(input.tenantDb, settings);
    await this.expireOldRequests(input.tenantDb);

    const claimed = await this.claimDueRequests(input.tenantDb);
    for (const request of claimed) {
      await this.sendReviewRequest(input, request, settings);
    }
    return claimed.length;
  }

  private async scheduleMissingPaidInvoices(
    tenantDb: TenantPrismaClient,
    settings: ReviewSettings,
  ): Promise<void> {
    const invoices = await (tenantDb as any).invoice.findMany({
      where: {
        status: 'paid',
        reviewRequest: { is: null },
      },
      include: {
        client: { select: { id: true, fullName: true, phone: true } },
        appointment: { select: { id: true, status: true } },
      },
      orderBy: { paidAt: 'asc' },
      take: ReviewRequestsService.BATCH_SIZE,
    });

    for (const invoice of invoices) {
      if (!invoice.client?.phone) continue;
      if (invoice.appointment && invoice.appointment.status !== 'completed') continue;
      await this.createReviewRequest(tenantDb, {
        invoiceId: invoice.id,
        appointmentId: invoice.appointmentId ?? null,
        customerPhone: invoice.client.phone,
        customerName: invoice.client.fullName ?? null,
        source: 'invoice',
        baseDate: invoice.paidAt ?? new Date(),
        settings,
      });
    }
  }

  private async createReviewRequest(
    tenantDb: TenantPrismaClient,
    params: {
      invoiceId: string | null;
      appointmentId: string | null;
      customerPhone: string;
      customerName: string | null;
      source: string;
      baseDate: Date;
      settings: ReviewSettings;
    },
  ): Promise<{ id: string }> {
    const reviewRequest = (tenantDb as any).reviewRequest;
    const or: Array<Record<string, string>> = [];
    if (params.invoiceId) or.push({ invoiceId: params.invoiceId });
    if (params.appointmentId) or.push({ appointmentId: params.appointmentId });

    if (or.length > 0) {
      const existing = await reviewRequest.findFirst({ where: { OR: or } });
      if (existing) return existing;
    }

    const dueAt = new Date(params.baseDate.getTime() + params.settings.delayMinutes * 60_000);
    const expiresAt = new Date(dueAt.getTime() + ReviewRequestsService.RESPONSE_TTL_DAYS * 24 * 60 * 60_000);

    try {
      return await reviewRequest.create({
        data: {
          invoiceId: params.invoiceId,
          appointmentId: params.appointmentId,
          customerPhone: this.normalizePhone(params.customerPhone),
          customerName: params.customerName,
          source: params.source,
          status: 'pending',
          dueAt,
          expiresAt,
        },
      });
    } catch (err) {
      if (this.isUniqueConflict(err) && or.length > 0) {
        const existing = await reviewRequest.findFirst({ where: { OR: or } });
        if (existing) return existing;
      }
      throw err;
    }
  }

  private async claimDueRequests(tenantDb: TenantPrismaClient): Promise<ClaimedReviewRequest[]> {
    return (tenantDb as any).$queryRawUnsafe(`
      UPDATE "review_requests"
      SET "status" = 'sending', "updated_at" = NOW()
      WHERE "id" IN (
        SELECT "id"
        FROM "review_requests"
        WHERE "status" = 'pending'
          AND "due_at" <= NOW()
          AND "expires_at" > NOW()
        ORDER BY "due_at" ASC
        LIMIT ${ReviewRequestsService.BATCH_SIZE}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING
        "id",
        "appointment_id" AS "appointmentId",
        "invoice_id" AS "invoiceId",
        "customer_phone" AS "customerPhone",
        "customer_name" AS "customerName"
    `);
  }

  private async sendReviewRequest(
    input: {
      tenantDb: TenantPrismaClient;
      tenantId: string;
      instanceName: string;
      instanceToken: string;
    },
    request: ClaimedReviewRequest,
    settings: ReviewSettings,
  ): Promise<void> {
    const antiBan = await this.antiBan.check({
      tenantId: input.tenantId,
      tenantDb: input.tenantDb,
      phone: request.customerPhone,
      isMarketing: false,
    });

    if (!antiBan.allowed) {
      if (antiBan.reason === 'recipient_opted_out') {
        await (input.tenantDb as any).reviewRequest.update({
          where: { id: request.id },
          data: { status: 'skipped', updatedAt: new Date() },
        });
        return;
      }

      await (input.tenantDb as any).reviewRequest.update({
        where: { id: request.id },
        data: {
          status: 'pending',
          dueAt: new Date(Date.now() + 5 * 60_000),
          updatedAt: new Date(),
        },
      });
      return;
    }

    const blockedByConversation = await this.isDoNotDisturb(input.tenantDb, request.customerPhone);
    if (blockedByConversation) {
      await (input.tenantDb as any).reviewRequest.update({
        where: { id: request.id },
        data: { status: 'skipped', updatedAt: new Date() },
      });
      return;
    }

    const salonName = await this.getSalonName(input.tenantDb);
    const message = `شكرًا لزيارتك ${salonName}.\n${settings.requestMessage}`;

    try {
      await this.sendText(input.instanceName, input.instanceToken, request.customerPhone, message, antiBan.delayMs);
      await (input.tenantDb as any).reviewRequest.update({
        where: { id: request.id },
        data: {
          status: 'sent',
          requestSentAt: new Date(),
          updatedAt: new Date(),
        },
      });
    } catch (err) {
      await (input.tenantDb as any).reviewRequest.update({
        where: { id: request.id },
        data: {
          status: 'pending',
          dueAt: new Date(Date.now() + 5 * 60_000),
          updatedAt: new Date(),
        },
      });
      this.logger.error(`Failed to send review request ${request.id}: ${(err as Error).message}`);
    }
  }

  private async handleHighRating(
    input: { tenantDb: TenantPrismaClient; instanceName: string; instanceToken: string; phone: string },
    request: ReviewRequestRecord,
    rating: number,
    settings: ReviewSettings,
  ): Promise<void> {
    const googleUrl = settings.googleReviewUrl || await this.getSalonGoogleUrl(input.tenantDb);
    await this.persistRating(input.tenantDb, request, rating, Boolean(googleUrl), false);

    const message = googleUrl
      ? this.interpolateGoogleUrl(settings.highRatingResponseMessage, googleUrl)
      : 'شكرًا لتقييمك. يسعدنا رضاك.';

    await this.sendText(input.instanceName, input.instanceToken, request.customerPhone, message);
  }

  private async handleMediumRating(
    input: { tenantDb: TenantPrismaClient; instanceName: string; instanceToken: string; phone: string },
    request: ReviewRequestRecord,
    rating: number,
  ): Promise<void> {
    await this.persistRating(input.tenantDb, request, rating, false, false);
    await this.sendText(input.instanceName, input.instanceToken, request.customerPhone, 'شكرًا لتقييمك. ملاحظتك تساعدنا نحسن الخدمة.');
  }

  private async handleLowRating(
    input: { tenantDb: TenantPrismaClient; instanceName: string; instanceToken: string; phone: string; text: string },
    request: ReviewRequestRecord,
    rating: number,
    settings: ReviewSettings,
  ): Promise<void> {
    await this.persistRating(input.tenantDb, request, rating, false, true);
    await this.createLowRatingEscalation(
      input.tenantDb,
      request,
      rating,
      input.text,
      settings,
      input.instanceName,
      input.instanceToken,
    );
    await this.sendText(input.instanceName, input.instanceToken, request.customerPhone, settings.lowRatingResponseMessage);
  }

  private async persistRating(
    tenantDb: TenantPrismaClient,
    request: ReviewRequestRecord,
    rating: number,
    googleLinkSent: boolean,
    needsFollowUp: boolean,
  ): Promise<void> {
    await (tenantDb as any).reviewRequest.update({
      where: { id: request.id },
      data: {
        status: 'responded',
        rating,
        respondedAt: new Date(),
        googleLinkSent,
        updatedAt: new Date(),
      },
    });

    if (!request.invoiceId) return;

    await (tenantDb as any).invoiceFeedback.upsert({
      where: { invoiceId: request.invoiceId },
      create: {
        invoiceId: request.invoiceId,
        rating,
        source: 'whatsapp',
        googlePromptShown: googleLinkSent,
        googleClicked: false,
        followUpStatus: needsFollowUp ? 'new' : 'reviewed',
      },
      update: {
        rating,
        source: 'whatsapp',
        googlePromptShown: googleLinkSent,
        followUpStatus: needsFollowUp ? 'new' : 'reviewed',
      },
    });
  }

  private async createLowRatingEscalation(
    tenantDb: TenantPrismaClient,
    request: ReviewRequestRecord,
    rating: number,
    originalText: string,
    settings: ReviewSettings,
    instanceName: string,
    instanceToken: string,
  ): Promise<void> {
    const conversation = await this.ensureConversation(tenantDb, request.customerPhone);
    const context = [
      `reviewRequestId=${request.id}`,
      request.invoiceId ? `invoiceId=${request.invoiceId}` : null,
      request.appointmentId ? `appointmentId=${request.appointmentId}` : null,
    ].filter(Boolean).join('; ');

    const escalation = await (tenantDb as any).aIEscalation.create({
      data: {
        conversationId: conversation.id,
        customerPhone: request.customerPhone,
        customerName: request.customerName,
        customerQuestion: `تقييم منخفض ${rating}/5`,
        lastCustomerMessage: originalText.slice(0, 1000),
        customerContext: context,
        escalationType: 'low_rating',
        uncertainReason: 'post_visit_review',
        notifiedManager: false,
        occurrenceCount: 1,
        status: 'pending',
      },
    });

    const notifiedManager = await this.notifyManagerLowRating(
      request,
      rating,
      settings,
      instanceName,
      instanceToken,
    );
    if (notifiedManager) {
      await (tenantDb as any).aIEscalation.update({
        where: { id: escalation.id },
        data: { notifiedManager: true, lastNotifiedAt: new Date() },
      });
    }
  }

  private async notifyManagerLowRating(
    request: ReviewRequestRecord,
    rating: number,
    settings: ReviewSettings,
    instanceName: string,
    instanceToken: string,
  ): Promise<boolean> {
    if (!settings.managerPhone) return false;

    const message = [
      'تقييم منخفض من عميل',
      '',
      `العميل: ${request.customerName || request.customerPhone}`,
      `التقييم: ${rating}/5`,
      `الموعد/الفاتورة: ${request.appointmentId || request.invoiceId || request.id}`,
      `الوقت: ${new Date().toISOString()}`,
    ].join('\n');

    await this.sendText(instanceName, instanceToken, settings.managerPhone, message);
    return true;
  }

  private async captureLowRatingComment(
    tenantDb: TenantPrismaClient,
    phone: string,
    text: string,
    lowRatingThreshold: number,
  ): Promise<boolean> {
    if (this.parseRating(text)) return false;

    const since = new Date(Date.now() - 24 * 60 * 60_000);
    const request = await (tenantDb as any).reviewRequest.findFirst({
      where: {
        customerPhone: phone,
        status: 'responded',
        rating: { lte: lowRatingThreshold },
        respondedAt: { gte: since },
        feedbackText: null,
      },
      orderBy: { respondedAt: 'desc' },
    }) as ReviewRequestRecord | null;

    if (!request) return false;

    await (tenantDb as any).reviewRequest.update({
      where: { id: request.id },
      data: { feedbackText: text.slice(0, 2000), updatedAt: new Date() },
    });

    if (request.invoiceId) {
      await (tenantDb as any).invoiceFeedback.updateMany({
        where: { invoiceId: request.invoiceId },
        data: { comment: text.slice(0, 2000) },
      });
    }
    return true;
  }

  private async ensureConversation(
    tenantDb: TenantPrismaClient,
    phone: string,
  ): Promise<{ id: string }> {
    const existing = await (tenantDb as any).aIConversation.findUnique({ where: { phone } });
    const state = existing?.state && typeof existing.state === 'object' && !Array.isArray(existing.state)
      ? existing.state
      : {};

    if (existing) {
      return (tenantDb as any).aIConversation.update({
        where: { phone },
        data: {
          lastActiveAt: new Date(),
          state: {
            ...state,
            currentIntent: 'review_feedback',
            updatedAt: new Date().toISOString(),
          },
        },
        select: { id: true },
      });
    }

    return (tenantDb as any).aIConversation.create({
      data: {
        phone,
        messages: [],
        state: {
          currentIntent: 'review_feedback',
          updatedAt: new Date().toISOString(),
        },
        lastActiveAt: new Date(),
      },
      select: { id: true },
    });
  }

  private async expireOldRequests(tenantDb: TenantPrismaClient): Promise<void> {
    await (tenantDb as any).reviewRequest.updateMany({
      where: {
        status: { in: ['pending', 'sent', 'sending'] },
        expiresAt: { lt: new Date() },
      },
      data: { status: 'expired', updatedAt: new Date() },
    });
  }

  private async isDoNotDisturb(tenantDb: TenantPrismaClient, phone: string): Promise<boolean> {
    const conversation = await (tenantDb as any).aIConversation.findUnique({
      where: { phone: this.normalizePhone(phone) },
      select: { state: true },
    });
    const state = conversation?.state;
    return Boolean(state && typeof state === 'object' && !Array.isArray(state) && (state as Record<string, unknown>).doNotDisturb);
  }

  private async getSettings(tenantDb: TenantPrismaClient): Promise<ReviewSettings> {
    const settings = await this.settingsService.getAll(tenantDb);
    const low = this.parseInt(settings[SETTINGS_KEYS.low_rating_threshold], 1, 4, 3);
    const highCandidate = this.parseInt(settings[SETTINGS_KEYS.high_rating_threshold], 2, 5, 4);
    const high = highCandidate <= low ? Math.min(5, low + 1) : highCandidate;

    return {
      enabled: settings[SETTINGS_KEYS.review_request_enabled] === 'true',
      delayMinutes: this.parseInt(settings[SETTINGS_KEYS.review_request_delay_minutes], 0, 1440, 60),
      googleReviewUrl: (settings[SETTINGS_KEYS.google_review_url] || '').trim(),
      lowRatingThreshold: low,
      highRatingThreshold: high,
      requestMessage: settings[SETTINGS_KEYS.review_request_message] || 'نسعد بمعرفة تقييمك لتجربتك من 1 إلى 5.',
      lowRatingResponseMessage: settings[SETTINGS_KEYS.low_rating_response_message] || 'نعتذر عن تجربتك. تم رفع ملاحظتك للإدارة لتحسين الخدمة.',
      highRatingResponseMessage: settings[SETTINGS_KEYS.high_rating_response_message] || 'شكرًا لتقييمك. يسعدنا دعمك بتقييمنا على Google: [googleReviewUrl]',
      managerPhone: (settings[SETTINGS_KEYS.ai_manager_phone] || '').trim(),
    };
  }

  private async getSalonName(tenantDb: TenantPrismaClient): Promise<string> {
    const salon = await (tenantDb as any).salonInfo.findFirst({
      select: { nameAr: true },
    });
    return salon?.nameAr || 'الصالون';
  }

  private async getSalonGoogleUrl(tenantDb: TenantPrismaClient): Promise<string> {
    const salon = await (tenantDb as any).salonInfo.findFirst({
      select: { googleMapsUrl: true },
    });
    return salon?.googleMapsUrl || '';
  }

  private interpolateGoogleUrl(template: string, googleUrl: string): string {
    if (template.includes('[googleReviewUrl]')) {
      return template.replace(/\[googleReviewUrl\]/g, googleUrl);
    }
    return `${template}\n${googleUrl}`;
  }

  private parseRating(text: string): number | null {
    const normalized = this.normalizeDigits(text).trim().toLowerCase();
    const numeric = normalized.match(/(?:^|[^\d])([1-5])(?:[^\d]|$)/);
    if (numeric) return Number(numeric[1]);

    const wordRatings: Array<[RegExp, number]> = [
      [/(واحد|واحدة|نجمة)/, 1],
      [/(اثنين|ثنين|نجمتين)/, 2],
      [/(ثلاثة|ثلاث|ثلاثه)/, 3],
      [/(أربعة|اربعة|اربع|أربع)/, 4],
      [/(خمسة|خمس|خمسه|ممتاز)/, 5],
    ];
    return wordRatings.find(([regex]) => regex.test(normalized))?.[1] ?? null;
  }

  private normalizeDigits(text: string): string {
    const arabic = '٠١٢٣٤٥٦٧٨٩';
    const persian = '۰۱۲۳۴۵۶۷۸۹';
    return text.replace(/[٠-٩۰-۹]/g, (d) => {
      const arabicIndex = arabic.indexOf(d);
      if (arabicIndex >= 0) return String(arabicIndex);
      const persianIndex = persian.indexOf(d);
      return persianIndex >= 0 ? String(persianIndex) : d;
    });
  }

  private parseInt(value: string | undefined, min: number, max: number, fallback: number): number {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    if (!Number.isInteger(parsed) || parsed < min || parsed > max) return fallback;
    return parsed;
  }

  private normalizePhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('966')) return digits;
    if (digits.startsWith('0')) return `966${digits.slice(1)}`;
    return `966${digits}`;
  }

  private async sendText(
    instanceName: string,
    instanceToken: string,
    to: string,
    message: string,
    delayMs = 0,
  ): Promise<void> {
    await this.evolutionService.sendText({
      instanceName,
      instanceToken,
      to,
      message,
      delayMs,
    });
  }

  private isUniqueConflict(err: unknown): boolean {
    return typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002';
  }
}
