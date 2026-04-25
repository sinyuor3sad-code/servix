import { Injectable, Logger } from '@nestjs/common';
import { PlatformPrismaClient } from '../../../shared/database/platform.client';
import { WhatsAppEvolutionService } from '../whatsapp-evolution/whatsapp-evolution.service';
import { AIReceptionBookingService } from './ai-reception-booking.service';
import type { TenantPrismaClient } from '../../../shared/types';

interface ParsedReply {
  decision: 'approve' | 'reject' | 'alternative' | 'unknown';
  actionId?: number;
  alternativeTime?: string;
  missingActionId?: boolean;
}

type PendingActionRecord = {
  id: number;
  conversationId: string;
  type: string;
  payload: unknown;
  status: string;
  customerPhone: string;
  expiresAt: Date;
  doNotDisturb?: boolean;
};

/**
 * Processes owner approval commands for pending AI reception actions.
 *
 * Supported formats:
 * - موافق 123 / اوافق 123 / قبول 123 / approve 123 / yes 123
 * - رفض 123 / ارفض 123 / غير متاح 123 / reject 123 / no 123
 * - بديل 123 5:30 مساءً / وقت بديل 123 4 العصر / alternative 123 5:30 PM
 */
@Injectable()
export class ManagerReplyHandler {
  private readonly logger = new Logger(ManagerReplyHandler.name);

  private static readonly ESCALATION_MATCH_WINDOW_MS = 60 * 60 * 1000;

  constructor(
    private readonly platformDb: PlatformPrismaClient,
    private readonly evolutionService: WhatsAppEvolutionService,
    private readonly booking: AIReceptionBookingService,
  ) {}

  async handle(params: {
    tenantDb: TenantPrismaClient;
    tenantId: string;
    instanceName: string;
    instanceToken: string;
    text: string;
    managerPhone: string;
  }): Promise<void> {
    const { tenantDb, instanceName, instanceToken, text, managerPhone } = params;
    const parsed = this.parseManagerReply(text);

    if (parsed.decision === 'unknown') {
      if (parsed.missingActionId) {
        await this.sendReply(instanceName, instanceToken, managerPhone, 'فضلاً اكتب رقم الطلب، مثل: موافق 123');
        return;
      }

      const handled = await this.tryHandleTrainingReply({
        tenantDb,
        instanceName,
        instanceToken,
        text,
        managerPhone,
      });
      if (!handled) {
        this.logger.debug(`Manager message from ${managerPhone} is not a decision and no pending escalation was found.`);
      }
      return;
    }

    if (!parsed.actionId) {
      await this.sendReply(instanceName, instanceToken, managerPhone, 'فضلاً اكتب رقم الطلب، مثل: موافق 123');
      return;
    }

    const action = await this.findActionById(tenantDb, parsed.actionId);
    if (!action) {
      await this.sendReply(instanceName, instanceToken, managerPhone, 'لم أجد طلبًا بهذا الرقم.');
      return;
    }

    const now = new Date();
    if (!this.canOwnerProcessAction(action, now)) {
      await this.sendReply(instanceName, instanceToken, managerPhone, 'هذا الطلب لم يعد بانتظار الموافقة.');
      return;
    }

    if (parsed.decision === 'approve') {
      await this.approveAction({ tenantDb, instanceName, instanceToken, managerPhone, action, now });
      return;
    }

    if (parsed.decision === 'reject') {
      await this.rejectAction({ tenantDb, instanceName, instanceToken, managerPhone, action, now });
      return;
    }

    await this.suggestAlternative({
      tenantDb,
      instanceName,
      instanceToken,
      managerPhone,
      action,
      alternativeTime: parsed.alternativeTime || '',
      now,
    });
  }

  parseManagerReply(text: string): ParsedReply {
    const normalized = this.normalizeCommandText(text);

    const alternative = normalized.match(/^(?:بديل|وقت بديل|alternative)\s+#?(\d+)\s+(.+)$/i);
    if (alternative) {
      return {
        decision: 'alternative',
        actionId: Number(alternative[1]),
        alternativeTime: alternative[2].trim(),
      };
    }
    if (/^(?:بديل|وقت بديل|alternative)\b/i.test(normalized)) {
      return { decision: 'unknown', missingActionId: true };
    }

    const approve = normalized.match(/^(?:موافق|اوافق|أوافق|قبول|approve|yes|ok|نعم)(?:\s+#?(\d+))?\s*$/i);
    if (approve) {
      return approve[1]
        ? { decision: 'approve', actionId: Number(approve[1]) }
        : { decision: 'unknown', missingActionId: true };
    }

    const reject = normalized.match(/^(?:رفض|ارفض|أرفض|غير متاح|reject|no|لا)(?:\s+#?(\d+))?\s*$/i);
    if (reject) {
      return reject[1]
        ? { decision: 'reject', actionId: Number(reject[1]) }
        : { decision: 'unknown', missingActionId: true };
    }

    return { decision: 'unknown' };
  }

  private async approveAction(params: {
    tenantDb: TenantPrismaClient;
    instanceName: string;
    instanceToken: string;
    managerPhone: string;
    action: PendingActionRecord;
    now: Date;
  }): Promise<void> {
    const { tenantDb, instanceName, instanceToken, managerPhone, action, now } = params;
    const result = await this.booking.createConfirmedAppointmentFromAction(tenantDb, {
      action,
      allowedStatuses: ['awaiting_manager'],
      claimStatus: 'approved',
      actorPhone: managerPhone,
      now,
    });

    if (result.status === 'stale_action') {
      await this.sendReply(instanceName, instanceToken, managerPhone, 'هذا الطلب لم يعد بانتظار الموافقة.');
      return;
    }

    if (result.status === 'created' && result.appointmentId) {
      await this.mergeConversationState(tenantDb, action.conversationId, {
        currentIntent: 'booking',
        bookingStep: 'completed',
        awaitingOwnerApproval: false,
        requestId: action.id,
        appointmentId: result.appointmentId,
        selectedDate: result.dateIso,
        selectedTime: result.startTime,
        lastOwnerDecision: 'approved',
      });

      await this.sendReply(
        instanceName,
        instanceToken,
        action.customerPhone,
        this.buildConfirmedCustomerMessage(result),
      );
      await this.sendReply(instanceName, instanceToken, managerPhone, `تم تثبيت الحجز #${action.id} في جدول المواعيد.`);

      this.logger.log(`Action #${action.id} approved by ${managerPhone}; appointment ${result.appointmentId} created`);
      return;
    }

    if (result.status === 'conflict') {
      await this.mergeConversationState(tenantDb, action.conversationId, {
        currentIntent: 'booking',
        bookingStep: 'awaiting_owner_approval',
        awaitingOwnerApproval: true,
        requestId: action.id,
        lastOwnerDecision: 'approved',
      });
      await this.sendReply(
        instanceName,
        instanceToken,
        managerPhone,
        `تعذر تثبيت الطلب #${action.id} لأن الوقت لم يعد متاحًا. اقترح وقتًا بديلًا باستخدام: بديل ${action.id} [الوقت]`,
      );
      await this.sendReply(
        instanceName,
        instanceToken,
        action.customerPhone,
        'نعتذر، الوقت المطلوب لم يعد متاحًا. بنرسل لك وقتًا بديلًا بعد تأكيد الصالون.',
      );
      return;
    }

    const managerReply = result.status === 'ambiguous_date'
      ? `تعذر تثبيت الطلب #${action.id} لأن التاريخ غير واضح. يرجى اقتراح وقت بديل بصيغة أوضح: بديل ${action.id} [الوقت]`
      : result.status === 'ambiguous_time'
        ? `تعذر تثبيت الطلب #${action.id} لأن الوقت غير واضح. يرجى اقتراح وقت بديل بصيغة أوضح: بديل ${action.id} [الوقت]`
        : `تعذر تثبيت الطلب #${action.id} تلقائيًا. يرجى تثبيته يدويًا أو اقتراح وقت بديل.`;
    await this.sendReply(instanceName, instanceToken, managerPhone, managerReply);
    await this.sendReply(
      instanceName,
      instanceToken,
      action.customerPhone,
      'وصلت موافقة الصالون، لكن نحتاج تثبيت الموعد يدويًا. سيتم إشعارك قريبًا.',
    );

  }

  private async rejectAction(params: {
    tenantDb: TenantPrismaClient;
    instanceName: string;
    instanceToken: string;
    managerPhone: string;
    action: PendingActionRecord;
    now: Date;
  }): Promise<void> {
    const { tenantDb, instanceName, instanceToken, managerPhone, action, now } = params;
    const payload = this.mergePayloadMetadata(action.payload, {
      rejectedAt: now.toISOString(),
      rejectedBy: managerPhone,
    });

    const updateResult = await (tenantDb as any).aIPendingAction.updateMany({
      where: {
        id: action.id,
        status: 'awaiting_manager',
        doNotDisturb: false,
        expiresAt: { gt: now },
      },
      data: {
        status: 'rejected',
        resolvedAt: now,
        resolvedBy: managerPhone,
        payload,
      },
    });

    if (updateResult.count !== 1) {
      await this.sendReply(instanceName, instanceToken, managerPhone, 'هذا الطلب لم يعد بانتظار الموافقة.');
      return;
    }

    await this.mergeConversationState(tenantDb, action.conversationId, {
      currentIntent: 'booking',
      bookingStep: 'cancelled',
      awaitingOwnerApproval: false,
      requestId: action.id,
      lastOwnerDecision: 'rejected',
    });

    await this.sendReply(
      instanceName,
      instanceToken,
      action.customerPhone,
      'نعتذر، الوقت المطلوب غير متاح.\nتقدر تختار وقتًا آخر ونرسله للتأكيد.',
    );
    await this.sendReply(instanceName, instanceToken, managerPhone, `تم رفض الطلب #${action.id} وإبلاغ العميل.`);

    this.logger.log(`Action #${action.id} rejected by ${managerPhone}`);
  }

  private async suggestAlternative(params: {
    tenantDb: TenantPrismaClient;
    instanceName: string;
    instanceToken: string;
    managerPhone: string;
    action: PendingActionRecord;
    alternativeTime: string;
    now: Date;
  }): Promise<void> {
    const { tenantDb, instanceName, instanceToken, managerPhone, action, alternativeTime, now } = params;
    if (!alternativeTime.trim()) {
      await this.sendReply(instanceName, instanceToken, managerPhone, `فضلاً اكتب الوقت البديل، مثل: بديل ${action.id} 5:30 مساءً`);
      return;
    }

    const payload = this.mergePayloadMetadata(action.payload, {
      alternativeTime,
      alternativeSuggestedAt: now.toISOString(),
      alternativeSuggestedBy: managerPhone,
    });
    payload.alternativeTime = alternativeTime;

    const updateResult = await (tenantDb as any).aIPendingAction.updateMany({
      where: {
        id: action.id,
        status: 'awaiting_manager',
        doNotDisturb: false,
        expiresAt: { gt: now },
      },
      data: {
        status: 'awaiting_customer',
        payload,
      },
    });

    if (updateResult.count !== 1) {
      await this.sendReply(instanceName, instanceToken, managerPhone, 'هذا الطلب لم يعد بانتظار الموافقة.');
      return;
    }

    await this.mergeConversationState(tenantDb, action.conversationId, {
      currentIntent: 'booking',
      bookingStep: 'awaiting_customer_alternative_confirmation',
      awaitingOwnerApproval: false,
      requestId: action.id,
      alternativeTime,
      lastOwnerDecision: 'alternative',
    });

    await this.sendReply(
      instanceName,
      instanceToken,
      action.customerPhone,
      `الصالون اقترح وقتًا بديلًا: ${alternativeTime}.\nيناسبك هذا الموعد؟`,
    );
    await this.sendReply(instanceName, instanceToken, managerPhone, `تم إرسال الوقت البديل للعميل للطلب #${action.id}.`);

    this.logger.log(`Action #${action.id} alternative suggested by ${managerPhone}: ${alternativeTime}`);
  }

  private async tryHandleTrainingReply(params: {
    tenantDb: TenantPrismaClient;
    instanceName: string;
    instanceToken: string;
    text: string;
    managerPhone: string;
  }): Promise<boolean> {
    const { tenantDb, instanceName, instanceToken, text, managerPhone } = params;
    const cutoff = new Date(Date.now() - ManagerReplyHandler.ESCALATION_MATCH_WINDOW_MS);

    const escalation = await (tenantDb as any).aIEscalation.findFirst({
      where: { status: 'pending', createdAt: { gt: cutoff } },
      orderBy: { createdAt: 'desc' },
    });

    if (!escalation) return false;

    const answer = text.trim();
    if (!answer) return false;

    const keywords = this.buildKeywords(escalation.customerQuestion);
    const snippet = await (tenantDb as any).aIKnowledgeSnippet.create({
      data: {
        question: escalation.customerQuestion,
        answer,
        keywords,
        sourceEscalationId: escalation.id,
      },
    });

    await (tenantDb as any).aIEscalation.update({
      where: { id: escalation.id },
      data: {
        status: 'answered',
        managerAnswer: answer,
        snippetId: snippet.id,
        answeredAt: new Date(),
      },
    });

    await this.sendReply(instanceName, instanceToken, escalation.customerPhone, answer);
    await this.sendReply(
      instanceName,
      instanceToken,
      managerPhone,
      `تم إرسال الرد للعميل (${escalation.customerPhone}) وحفظه للمرات القادمة.`,
    );

    this.logger.log(`Escalation #${escalation.id} resolved and snippet #${snippet.id} learned`);
    return true;
  }

  private async findActionById(
    tenantDb: TenantPrismaClient,
    actionId: number,
  ): Promise<PendingActionRecord | null> {
    return (tenantDb as any).aIPendingAction.findFirst({
      where: { id: actionId },
    }) as Promise<PendingActionRecord | null>;
  }

  private canOwnerProcessAction(action: PendingActionRecord, now: Date): boolean {
    return action.status === 'awaiting_manager' &&
      !action.doNotDisturb &&
      (!action.expiresAt || action.expiresAt > now);
  }

  private async mergeConversationState(
    tenantDb: TenantPrismaClient,
    conversationId: string,
    patch: Record<string, unknown>,
  ): Promise<void> {
    const conversation = await (tenantDb as any).aIConversation.findUnique({
      where: { id: conversationId },
    });
    const state = conversation?.state && typeof conversation.state === 'object' && !Array.isArray(conversation.state)
      ? conversation.state as Record<string, unknown>
      : {};

    await (tenantDb as any).aIConversation.update({
      where: { id: conversationId },
      data: {
        state: {
          ...state,
          ...patch,
          updatedAt: new Date().toISOString(),
        },
      },
    });
  }

  private buildConfirmedCustomerMessage(result: {
    serviceName?: string;
    dateIso?: string;
    displayTime?: string;
    startTime?: string;
    price?: number;
  }): string {
    return [
      'تم تأكيد حجزك ✅',
      `الخدمة: ${result.serviceName || 'الخدمة'}`,
      `التاريخ: ${result.dateIso || 'غير محدد'}`,
      `الوقت: ${result.displayTime || result.startTime || 'غير محدد'}`,
      `السعر: ${this.formatPrice(Number(result.price || 0))}`,
      'ننتظرك.',
    ].join('\n');
  }

  private formatPrice(price: number): string {
    const amount = Number.isInteger(price) ? String(price) : price.toFixed(2);
    return `${amount} ر.س`;
  }

  private mergePayloadMetadata(
    payload: unknown,
    metadata: Record<string, unknown>,
  ): Record<string, unknown> {
    const base = payload && typeof payload === 'object' && !Array.isArray(payload)
      ? payload as Record<string, unknown>
      : {};
    const existingMetadata = base.metadata && typeof base.metadata === 'object' && !Array.isArray(base.metadata)
      ? base.metadata as Record<string, unknown>
      : {};

    return {
      ...base,
      metadata: {
        ...existingMetadata,
        ...metadata,
      },
    };
  }

  private buildKeywords(text: string): string {
    const stopwords = new Set([
      'في','من','على','الى','إلى','عن','مع','هل','ما','او','أو','و','ف','ب','ال',
      'the','a','an','is','are','do','you','have','has','and','or','of','to','for',
    ]);
    return text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter(t => t.length >= 3 && !stopwords.has(t))
      .slice(0, 12)
      .join(',');
  }

  private normalizeCommandText(text: string): string {
    return this.normalizeArabicDigits(text)
      .replace(/[أإآ]/g, 'ا')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private normalizeArabicDigits(text: string): string {
    const arabic = '٠١٢٣٤٥٦٧٨٩';
    const persian = '۰۱۲۳۴۵۶۷۸۹';
    return text.replace(/[٠-٩۰-۹]/g, (char) => {
      const arabicIndex = arabic.indexOf(char);
      if (arabicIndex >= 0) return String(arabicIndex);
      return String(persian.indexOf(char));
    });
  }

  private async sendReply(
    instanceName: string,
    instanceToken: string,
    to: string,
    message: string,
  ): Promise<void> {
    try {
      await this.evolutionService.sendText({
        instanceName,
        instanceToken,
        to,
        message,
        delayMs: Math.floor(1000 + Math.random() * 2000),
      });
    } catch (err) {
      this.logger.error(`Failed to send to ${to}: ${(err as Error).message}`);
    }
  }
}
