import { Injectable, Logger } from '@nestjs/common';
import { PlatformPrismaClient } from '../../../shared/database/platform.client';
import { WhatsAppEvolutionService } from '../whatsapp-evolution/whatsapp-evolution.service';
import type { TenantPrismaClient } from '../../../shared/types';

// ─────────────────── Types ───────────────────

interface ParsedReply {
  decision: 'approve' | 'reject' | 'unknown';
  actionId?: number;
}

/**
 * Manager Reply Handler — Processes approval/rejection messages from the salon manager.
 *
 * Supported formats:
 *   - "موافق" / "موافق 247" / "موافق #247"
 *   - "ok" / "نعم" / "نعم 247"
 *   - "رفض" / "رفض 247" / "لا" / "ارفض"
 *
 * If no action ID is specified, uses the latest awaiting_manager action.
 */
@Injectable()
export class ManagerReplyHandler {
  private readonly logger = new Logger(ManagerReplyHandler.name);

  // Approval regex: Arabic + English keywords, optional #ID
  private readonly approveRegex = /^(موافق|ok|نعم|أوكيه|اوكيه|تمام|قبول)(?:\s+#?(\d+))?\b/i;
  // Rejection regex
  private readonly rejectRegex = /^(رفض|ارفض|لا|مرفوض|reject|no)(?:\s+#?(\d+))?\b/i;

  constructor(
    private readonly platformDb: PlatformPrismaClient,
    private readonly evolutionService: WhatsAppEvolutionService,
  ) {}

  /**
   * Handle a reply from the manager.
   */
  async handle(params: {
    tenantDb: TenantPrismaClient;
    tenantId: string;
    instanceName: string;
    instanceToken: string;
    text: string;
    managerPhone: string;
  }): Promise<void> {
    const { tenantDb, tenantId, instanceName, instanceToken, text, managerPhone } = params;

    const parsed = this.parseManagerReply(text);
    if (parsed.decision === 'unknown') {
      // Not a decision message — ignore (could be normal chat)
      return;
    }

    // Find the pending action
    const action = await this.findPendingAction(tenantDb, parsed.actionId);

    if (!action) {
      await this.sendReply(
        instanceName, instanceToken, managerPhone,
        parsed.actionId
          ? `❌ الطلب #${parsed.actionId} غير موجود أو منتهي الصلاحية.`
          : '❌ لا يوجد طلب معلّق حالياً.',
      );
      return;
    }

    const now = new Date();

    if (parsed.decision === 'approve') {
      // Update status to approved
      await (tenantDb as any).aIPendingAction.update({
        where: { id: action.id },
        data: {
          status: 'approved',
          resolvedAt: now,
          resolvedBy: managerPhone,
        },
      });

      // TODO Phase 4+: Execute the actual action (BookingService.createBooking, etc.)
      // For now, we notify the customer that the action was approved.

      const payload = action.payload as Record<string, unknown>;
      const serviceName = (payload.serviceName as string) || 'الخدمة';
      const date = (payload.date as string) || '';
      const time = (payload.time as string) || '';

      const typeLabel =
        action.type === 'book_appointment' ? 'تم تأكيد حجزك' :
        action.type === 'cancel_appointment' ? 'تم إلغاء موعدك' :
        'تم تعديل موعدك';

      // Notify customer
      await this.sendReply(
        instanceName, instanceToken, action.customerPhone,
        `✅ ${typeLabel}!\n\n📋 ${serviceName}\n📅 ${date} ${time}\n\nشكراً لتواصلك 💜`,
      );

      // Confirm to manager
      await this.sendReply(
        instanceName, instanceToken, managerPhone,
        `✓ تم تسجيل موافقتك على الطلب #${action.id} — العميل تم إبلاغه.`,
      );

      this.logger.log(`✅ Action #${action.id} approved by ${managerPhone}`);

    } else {
      // Reject
      await (tenantDb as any).aIPendingAction.update({
        where: { id: action.id },
        data: {
          status: 'rejected',
          resolvedAt: now,
          resolvedBy: managerPhone,
        },
      });

      // Notify customer
      await this.sendReply(
        instanceName, instanceToken, action.customerPhone,
        'نعتذر، لم نتمكن من تأكيد طلبك حالياً. يمكنك التواصل مع الصالون مباشرة لترتيب موعد بديل. 🙏',
      );

      // Confirm to manager
      await this.sendReply(
        instanceName, instanceToken, managerPhone,
        `✓ تم تسجيل رفضك للطلب #${action.id} — العميل تم إبلاغه.`,
      );

      this.logger.log(`❌ Action #${action.id} rejected by ${managerPhone}`);
    }
  }

  /**
   * Parse a manager's reply text into a structured decision.
   */
  parseManagerReply(text: string): ParsedReply {
    const trimmed = text.trim();

    const approveMatch = trimmed.match(this.approveRegex);
    if (approveMatch) {
      return {
        decision: 'approve',
        actionId: approveMatch[2] ? parseInt(approveMatch[2], 10) : undefined,
      };
    }

    const rejectMatch = trimmed.match(this.rejectRegex);
    if (rejectMatch) {
      return {
        decision: 'reject',
        actionId: rejectMatch[2] ? parseInt(rejectMatch[2], 10) : undefined,
      };
    }

    return { decision: 'unknown' };
  }

  private async findPendingAction(tenantDb: TenantPrismaClient, actionId?: number) {
    if (actionId) {
      return (tenantDb as any).aIPendingAction.findFirst({
        where: {
          id: actionId,
          status: 'awaiting_manager',
        },
      });
    }

    // No ID specified → get the latest awaiting action (within expiry window)
    return (tenantDb as any).aIPendingAction.findFirst({
      where: {
        status: 'awaiting_manager',
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
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
