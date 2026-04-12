import { Injectable, Logger } from '@nestjs/common';
import { WhatsAppService, WhatsAppCredentials } from './whatsapp.service';
import { TenantResolverService } from './tenant-resolver.service';
import { GeminiService } from '../ai/gemini.service';
import { CalendarService } from '../calendar/calendar.service';
import { FeaturesService } from '../../core/features/features.service';

// ─────────────────── Types ───────────────────

export interface IncomingMessage {
  from: string;
  phoneNumberId: string;
  messageType: 'text' | 'audio' | 'image' | 'interactive';
  text?: string;
  audioId?: string;
  imageId?: string;
  interactive?: any;
  timestamp: string;
  messageId: string;
}

const GRAPH_API_VERSION = 'v21.0';

/**
 * WhatsApp Bot Service — Central processor for incoming WhatsApp messages.
 *
 * Phase 2: Integrated with Gemini AI for intelligent responses.
 * - Text messages → direct to Gemini chat
 * - Audio messages → transcribe via Gemini, then chat
 * - Image messages → describe via Gemini, then chat
 * - Interactive (buttons) → direct to Gemini chat
 */
@Injectable()
export class WhatsAppBotService {
  private readonly logger = new Logger(WhatsAppBotService.name);

  constructor(
    private readonly whatsapp: WhatsAppService,
    private readonly tenantResolver: TenantResolverService,
    private readonly gemini: GeminiService,
    private readonly calendar: CalendarService,
    private readonly features: FeaturesService,
  ) {}

  /**
   * Main entry point for processing incoming WhatsApp messages.
   * Called asynchronously from the webhook controller.
   */
  async processIncomingMessage(msg: IncomingMessage): Promise<void> {
    this.logger.log(
      `📨 Incoming ${msg.messageType} from ${msg.from} → phoneNumberId=${msg.phoneNumberId}`,
    );

    // 1. Resolve which Tenant (salon) this message belongs to
    const tenant = await this.tenantResolver.resolveByPhoneNumberId(
      msg.phoneNumberId,
    );
    if (!tenant) {
      this.logger.warn(
        `No tenant found for phoneNumberId: ${msg.phoneNumberId} — ignoring message`,
      );
      return;
    }

    this.logger.log(
      `🏪 Resolved tenant: ${tenant.salonName} (${tenant.id}) for phoneNumberId ${msg.phoneNumberId}`,
    );

    // 1.5 Check if tenant has 'whatsapp-bot' feature enabled
    const featureCheck = await this.features.isFeatureEnabled(tenant.id, 'whatsapp-bot');
    if (!featureCheck.isEnabled) {
      this.logger.log(
        `⛔ WhatsApp bot disabled for tenant ${tenant.salonName} — feature 'whatsapp-bot' not in plan`,
      );
      // Send a polite fallback message
      await this.whatsapp.send(
        { to: msg.from, message: 'أهلاً بك! للتواصل معنا يرجى الاتصال مباشرة. 🙏' },
        tenant.credentials,
      );
      return;
    }

    // 2. Gather salon context for AI
    const salonContext = await this.tenantResolver.getSalonContext(
      tenant.id,
      tenant.databaseName,
      msg.from, // client phone for personalized context
    );

    // 3. Extract user message text based on message type
    let userMessage = '';

    switch (msg.messageType) {
      case 'text':
        userMessage = msg.text || '';
        break;

      case 'audio':
        // Download audio from Meta, then transcribe via Gemini
        try {
          this.logger.log(
            `🎤 Downloading audio (mediaId: ${msg.audioId})...`,
          );
          const audioBuffer = await this.downloadMedia(
            msg.audioId!,
            tenant.credentials,
          );
          const transcription =
            await this.gemini.transcribeAudio(audioBuffer);

          if (transcription) {
            userMessage = transcription;
            this.logger.log(
              `🎤 Audio transcribed: "${transcription.substring(0, 80)}..."`,
            );
          } else {
            // Transcription failed — send fallback
            await this.sendFallbackAudioResponse(
              msg.from,
              tenant.salonName,
              tenant.credentials,
            );
            return;
          }
        } catch (err) {
          this.logger.error(
            `Audio processing failed: ${(err as Error).message}`,
          );
          await this.sendFallbackAudioResponse(
            msg.from,
            tenant.salonName,
            tenant.credentials,
          );
          return;
        }
        break;

      case 'image':
        // Download image from Meta, then describe via Gemini
        try {
          this.logger.log(
            `📷 Downloading image (mediaId: ${msg.imageId})...`,
          );
          const imageBuffer = await this.downloadMedia(
            msg.imageId!,
            tenant.credentials,
          );
          const description =
            await this.gemini.describeImage(imageBuffer);
          userMessage = `[العميل أرسل صورة] ${description}`;
          this.logger.log(
            `📷 Image described: "${description.substring(0, 80)}..."`,
          );
        } catch (err) {
          this.logger.error(
            `Image processing failed: ${(err as Error).message}`,
          );
          await this.sendFallbackImageResponse(
            msg.from,
            tenant.salonName,
            tenant.credentials,
          );
          return;
        }
        break;

      case 'interactive':
        // Customer pressed a button or selected from a list
        userMessage =
          msg.interactive?.button_reply?.title ||
          msg.interactive?.list_reply?.title ||
          '';
        break;

      default:
        this.logger.warn(`Unsupported message type: ${msg.messageType}`);
        return;
    }

    if (!userMessage) {
      this.logger.warn('Empty message content — skipping');
      return;
    }

    // 4. Get AI response via Gemini
    const response = await this.gemini.chat({
      tenantId: tenant.id,
      userPhone: msg.from,
      userMessage,
      salonContext,
    });

    // 5. Detect if AI response contains a booking confirmation and append calendar link
    let finalResponse = response;
    if (this.isBookingConfirmation(response)) {
      const calendarMsg = this.tryGenerateCalendarLink(
        response,
        salonContext,
      );
      if (calendarMsg) {
        finalResponse = `${response}\n\n${calendarMsg}`;
      }
    }

    // 6. Send response via WhatsApp
    try {
      await this.whatsapp.send(
        { to: msg.from, message: finalResponse },
        tenant.credentials,
      );
      this.logger.log(`✅ AI reply sent to ${msg.from}`);
    } catch (err) {
      this.logger.error(
        `Failed to send reply to ${msg.from}: ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }

  /**
   * Download media file from Meta Graph API (audio/image).
   * Two-step process: 1) Get download URL, 2) Download file.
   */
  async downloadMedia(
    mediaId: string,
    credentials: WhatsAppCredentials,
  ): Promise<Buffer> {
    // Step 1: Get the download URL from Meta
    const metaUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/${mediaId}`;
    const metaRes = await fetch(metaUrl, {
      headers: { Authorization: `Bearer ${credentials.token}` },
    });

    if (!metaRes.ok) {
      throw new Error(
        `Failed to get media URL: ${metaRes.status} ${await metaRes.text()}`,
      );
    }

    const { url } = (await metaRes.json()) as { url: string };

    // Step 2: Download the actual file
    const fileRes = await fetch(url, {
      headers: { Authorization: `Bearer ${credentials.token}` },
    });

    if (!fileRes.ok) {
      throw new Error(
        `Failed to download media: ${fileRes.status} ${await fileRes.text()}`,
      );
    }

    const arrayBuffer = await fileRes.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  // ─── Fallback Responses ───

  private async sendFallbackAudioResponse(
    to: string,
    salonName: string,
    credentials: WhatsAppCredentials,
  ): Promise<void> {
    const message = `مرحباً بك في ${salonName}! 🎙️\n\nللأسف لم نتمكن من فهم المقطع الصوتي.\nيمكنك كتابة استفسارك نصياً وسنساعدك فوراً! ✨`;
    try {
      await this.whatsapp.send({ to, message }, credentials);
    } catch (err) {
      this.logger.error(
        `Failed to send audio fallback: ${(err as Error).message}`,
      );
    }
  }

  private async sendFallbackImageResponse(
    to: string,
    salonName: string,
    credentials: WhatsAppCredentials,
  ): Promise<void> {
    const message = `مرحباً بك في ${salonName}! 📷\n\nللأسف لم نتمكن من تحليل الصورة.\nيمكنك وصف ما تريد نصياً وسنساعدك! ✨`;
    try {
      await this.whatsapp.send({ to, message }, credentials);
    } catch (err) {
      this.logger.error(
        `Failed to send image fallback: ${(err as Error).message}`,
      );
    }
  }

  // ─── Calendar Link Helpers ───

  /**
   * Detect if AI response contains a booking confirmation.
   * Looks for Arabic/English booking confirmation signals in the response.
   */
  private isBookingConfirmation(response: string): boolean {
    const confirmationSignals = [
      'تم الحجز',
      'تم تأكيد',
      'موعدك',
      'تم حجز',
      'حجزنا لك',
      'booking confirmed',
      'appointment confirmed',
      'أضف لتقويمك',
      'التقويم',
      '📅',
    ];

    const lowerResponse = response.toLowerCase();
    return confirmationSignals.some((signal) =>
      lowerResponse.includes(signal.toLowerCase()),
    );
  }

  /**
   * Try to extract booking details from AI response and generate a calendar link.
   * If extraction fails, returns null (the AI response is still sent without calendar).
   */
  private tryGenerateCalendarLink(
    response: string,
    salonContext: any,
  ): string | null {
    try {
      // Try to extract a date/time from the AI response
      // Look for common patterns like "4:30" or "٤:٣٠" or "16:30"
      const timeMatch = response.match(/(\d{1,2}):(\d{2})/);
      if (!timeMatch) return null;

      const salonName = salonContext?.salonName || 'الصالون';
      const salonAddress =
        salonContext?.workingHours
          ? `${salonName}`
          : salonName;

      // Extract service name from context or response
      const serviceName =
        salonContext?.services?.[0]?.name || 'خدمة صالون';

      // Default to tomorrow if no specific date found
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const hours = parseInt(timeMatch[1], 10);
      const minutes = parseInt(timeMatch[2], 10);

      // Determine if PM based on context (Arabic PM indicators)
      const isPM =
        response.includes('مساء') ||
        response.includes('عصر') ||
        response.includes('PM') ||
        response.includes('pm');
      const adjustedHours =
        isPM && hours < 12 ? hours + 12 : hours;

      // Set the appointment time (Riyadh = UTC+3, so subtract 3 for UTC)
      tomorrow.setUTCHours(adjustedHours - 3, minutes, 0, 0);

      const calendarUrl = this.calendar.generateAppointmentCalendarUrl({
        serviceName,
        employeeName: salonContext?.employees?.[0]?.name || '',
        salonName,
        salonAddress,
        startDate: tomorrow,
        durationMinutes: salonContext?.services?.[0]?.duration || 60,
        price: salonContext?.services?.[0]?.price || 0,
      });

      return `📅 أضف لتقويمك (يذكّرك تلقائياً ⏰):\n${calendarUrl}`;
    } catch (err) {
      this.logger.debug(
        `Calendar link generation skipped: ${(err as Error).message}`,
      );
      return null;
    }
  }
}
