import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type CircuitBreaker from 'opossum';
import { PlatformSettingsService } from '../database/platform-settings.service';
import { CircuitBreakerService } from '../resilience/circuit-breaker.service';

interface SendSmsOptions {
  to: string;
  message: string;
}

@Injectable()
export class SmsService implements OnModuleInit {
  private logger = new Logger(SmsService.name);
  private unifonicBreaker!: CircuitBreaker<[SendSmsOptions, string, string], void>;

  constructor(
    private readonly configService: ConfigService,
    private readonly platformSettings: PlatformSettingsService,
    private readonly circuitBreaker: CircuitBreakerService,
  ) {}

  onModuleInit() {
    this.unifonicBreaker = this.circuitBreaker.createBreaker(
      'sms-unifonic',
      (options: SendSmsOptions, appId: string, senderId: string) =>
        this.sendViaUnionicRaw(options, appId, senderId),
      { timeout: 10_000, errorThresholdPercentage: 50, resetTimeout: 30_000, volumeThreshold: 5 },
    );
  }

  /**
   * Send SMS using credentials from platform_settings table.
   * Currently supports Unifonic provider.
   * Falls back to logging if credentials aren't configured.
   */
  async send(options: SendSmsOptions): Promise<void> {
    const provider = await this.platformSettings.get('sms_provider', '');
    const appId = await this.platformSettings.get('sms_app_id', '');
    const senderId = await this.platformSettings.get('sms_sender_id', 'SERVIX');

    if (!provider || !appId) {
      this.logger.warn(`[SmsService] SMS not configured — message logged only`);
      this.logger.log(`  To: ${options.to}`);
      this.logger.log(`  Message: ${options.message.substring(0, 100)}...`);
      return;
    }

    try {
      if (provider.toLowerCase() === 'unifonic') {
        await this.unifonicBreaker.fire(options, appId, senderId);
      } else {
        this.logger.warn(`[SmsService] Unknown SMS provider: ${provider} — message logged only`);
        this.logger.log(`  To: ${options.to}, Message: ${options.message.substring(0, 100)}...`);
      }
    } catch (err) {
      this.logger.error(`Failed to send SMS to ${options.to}: ${(err as Error).message}`);
      throw err;
    }
  }

  private async sendViaUnionicRaw(options: SendSmsOptions, appId: string, senderId: string): Promise<void> {
    const url = 'https://el.cloud.unifonic.com/rest/SMS/messages';
    const body = new URLSearchParams({
      AppSid: appId,
      SenderID: senderId,
      Body: options.message,
      Recipient: options.to.replace(/^\+/, ''),
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Unifonic API error: ${response.status} ${text}`);
    }

    this.logger.log(`SMS sent via Unifonic to: ${options.to}`);
  }
}
