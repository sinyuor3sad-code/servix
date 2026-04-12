import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Logger,
  HttpCode,
} from '@nestjs/common';
import { Public } from '../decorators';
import { WhatsAppBotService } from './whatsapp-bot.service';

@Controller('webhooks/whatsapp')
export class WhatsAppWebhookController {
  private readonly logger = new Logger(WhatsAppWebhookController.name);

  constructor(private readonly botService: WhatsAppBotService) {}

  /**
   * GET — Meta Webhook Verification
   * Meta sends this request when registering the Webhook for the first time.
   * Must return hub.challenge as plain text if the verify_token matches.
   */
  @Public()
  @Get()
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ): string {
    const VERIFY_TOKEN =
      process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'servix-webhook-verify';

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      this.logger.log('✅ WhatsApp Webhook verified successfully');
      return challenge;
    }

    this.logger.warn(
      `⚠️ WhatsApp Webhook verification failed — mode=${mode}, tokenMatch=${token === VERIFY_TOKEN}`,
    );
    return 'Forbidden';
  }

  /**
   * POST — Receive incoming messages from Meta Cloud API
   * Always returns 200 to Meta to avoid retry storms.
   * Message processing happens asynchronously in the background.
   */
  @Public()
  @Post()
  @HttpCode(200)
  async handleIncoming(@Body() body: any): Promise<string> {
    try {
      const entry = body?.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;

      // Ignore status updates (sent, delivered, read)
      if (value?.statuses) {
        return 'OK';
      }

      const message = value?.messages?.[0];
      const metadata = value?.metadata;

      if (!message || !metadata) {
        return 'OK';
      }

      // Process the message in the background (don't make Meta wait)
      this.botService
        .processIncomingMessage({
          from: message.from, // Sender's phone number
          phoneNumberId: metadata.phone_number_id, // Salon's WhatsApp number (identifies Tenant)
          messageType: message.type, // text, audio, image, interactive
          text: message.text?.body, // Text content (if text message)
          audioId: message.audio?.id, // Media ID (if audio message)
          imageId: message.image?.id, // Media ID (if image message)
          interactive: message.interactive, // Button/list reply data
          timestamp: message.timestamp,
          messageId: message.id,
        })
        .catch((err) => {
          this.logger.error(
            `Failed to process message from ${message.from}: ${err.message}`,
            err.stack,
          );
        });

      return 'OK';
    } catch (err) {
      this.logger.error(
        `Webhook error: ${(err as Error).message}`,
        (err as Error).stack,
      );
      return 'OK'; // Always return 200 to Meta
    }
  }
}
