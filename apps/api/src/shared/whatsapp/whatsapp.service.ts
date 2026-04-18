import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type CircuitBreaker from 'opossum';
import { CircuitBreakerService } from '../resilience/circuit-breaker.service';

export interface WhatsAppCredentials {
  token: string;
  phoneNumberId: string;
}

export interface SendWhatsAppOptions {
  to: string;
  message: string;
  templateName?: string;
  templateParams?: string[];
}

export interface SendWhatsAppDocumentOptions {
  to: string;
  document: Buffer;
  filename: string;
  caption?: string;
}

const GRAPH_API_VERSION = 'v21.0';

@Injectable()
export class WhatsAppService implements OnModuleInit {
  private logger = new Logger(WhatsAppService.name);

  // One breaker per Meta Graph endpoint we hit. All tenants share these
  // because they all ride the same upstream — if Meta is degraded, every
  // tenant is affected the same way.
  private sendTextBreaker!: CircuitBreaker<[string, string, WhatsAppCredentials], void>;
  private uploadMediaBreaker!: CircuitBreaker<[string, FormData, WhatsAppCredentials], string>;
  private sendDocumentBreaker!: CircuitBreaker<[string, Record<string, unknown>, WhatsAppCredentials], void>;

  constructor(private readonly circuitBreaker: CircuitBreakerService) {}

  onModuleInit() {
    this.sendTextBreaker = this.circuitBreaker.createBreaker(
      'whatsapp-send-text',
      (url: string, body: string, credentials: WhatsAppCredentials) =>
        this.sendTextRaw(url, body, credentials),
      { timeout: 10_000, errorThresholdPercentage: 50, resetTimeout: 30_000, volumeThreshold: 5 },
    );

    this.uploadMediaBreaker = this.circuitBreaker.createBreaker(
      'whatsapp-upload-media',
      (url: string, form: FormData, credentials: WhatsAppCredentials) =>
        this.uploadMediaRaw(url, form, credentials),
      { timeout: 20_000, errorThresholdPercentage: 50, resetTimeout: 30_000, volumeThreshold: 5 },
    );

    this.sendDocumentBreaker = this.circuitBreaker.createBreaker(
      'whatsapp-send-document',
      (url: string, body: Record<string, unknown>, credentials: WhatsAppCredentials) =>
        this.sendDocumentRaw(url, body, credentials),
      { timeout: 10_000, errorThresholdPercentage: 50, resetTimeout: 30_000, volumeThreshold: 5 },
    );
  }

  private normalizePhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('966')) return digits;
    if (digits.startsWith('0')) return '966' + digits.slice(1);
    return '966' + digits;
  }

  async send(options: SendWhatsAppOptions, credentials: WhatsAppCredentials | null): Promise<void> {
    if (!credentials?.token || !credentials?.phoneNumberId) {
      this.logger.warn('WhatsApp not configured for this tenant');
      return;
    }

    const to = this.normalizePhone(options.to);
    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${credentials.phoneNumberId}/messages`;

    const body = JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { body: options.message },
    });

    await this.sendTextBreaker.fire(url, body, credentials);
    this.logger.log(`WhatsApp sent to ${to}`);
  }

  async sendDocument(options: SendWhatsAppDocumentOptions, credentials: WhatsAppCredentials | null): Promise<void> {
    if (!credentials?.token || !credentials?.phoneNumberId) {
      this.logger.warn('WhatsApp not configured for this tenant');
      return;
    }

    const to = this.normalizePhone(options.to);

    const mediaFormData = new FormData();
    const blob = new Blob([new Uint8Array(options.document)], { type: 'application/pdf' });
    mediaFormData.append('file', blob, options.filename);
    mediaFormData.append('type', 'application/pdf');

    const uploadUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/${credentials.phoneNumberId}/media`;
    const mediaId = await this.uploadMediaBreaker.fire(uploadUrl, mediaFormData, credentials);
    if (!mediaId) {
      throw new Error('WhatsApp media upload returned no ID');
    }

    const msgUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/${credentials.phoneNumberId}/messages`;
    const body = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'document',
      document: {
        id: mediaId,
        caption: options.caption ? options.caption.substring(0, 1024) : undefined,
        filename: options.filename,
      },
    };

    await this.sendDocumentBreaker.fire(msgUrl, body, credentials);
    this.logger.log(`WhatsApp document sent to ${to}`);
  }

  // ───────── Raw HTTP calls (invoked by breakers) ─────────

  private async sendTextRaw(url: string, body: string, credentials: WhatsAppCredentials): Promise<void> {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${credentials.token}`,
        'Content-Type': 'application/json',
      },
      body,
    });

    if (!res.ok) {
      const err = await res.text();
      this.logger.error(`WhatsApp send failed: ${res.status} ${err}`);
      throw new Error(`WhatsApp send failed: ${res.status}`);
    }
  }

  private async uploadMediaRaw(url: string, form: FormData, credentials: WhatsAppCredentials): Promise<string> {
    const uploadRes = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${credentials.token}` },
      body: form,
    });

    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      this.logger.error(`WhatsApp media upload failed: ${uploadRes.status} ${err}`);
      throw new Error(`WhatsApp media upload failed: ${uploadRes.status}`);
    }

    const { id: mediaId } = (await uploadRes.json()) as { id: string };
    return mediaId;
  }

  private async sendDocumentRaw(url: string, body: Record<string, unknown>, credentials: WhatsAppCredentials): Promise<void> {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${credentials.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      this.logger.error(`WhatsApp document send failed: ${res.status} ${err}`);
      throw new Error(`WhatsApp document send failed: ${res.status}`);
    }
  }
}
